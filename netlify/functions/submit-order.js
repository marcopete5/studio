// netlify/functions/submit-order.js

// CRITICAL: Ensure 'google-spreadsheet' and 'google-auth-library' are in your root package.json
// and that they are correctly installed during Netlify's build process.
// If these imports fail or the libraries are not bundled correctly, 'GoogleSpreadsheet' or 'JWT'
// might be undefined, leading to "TypeError: ... is not a function" when using `new`.
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const setCorsHeaders = (response) => {
    response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.ALLOWED_ORIGIN || '*' // Consider making this more specific than '*' for production
    );
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export default async (req, context) => {
    // It's helpful to log the very start of the function to see if it's even reached
    // before a potential import-related TypeError.
    console.log(
        '[submit-order] Netlify Function handler started. Method:',
        req.method
    );

    // Check if `JWT` and `GoogleSpreadsheet` are defined.
    // This is a manual check you can add for debugging the TypeError.
    // In production, you'd rely on catching errors from `new JWT` or `new GoogleSpreadsheet`.
    if (typeof JWT !== 'function') {
        console.error(
            '[submit-order] CRITICAL FAILURE: JWT is not a function. Check google-auth-library import and installation.'
        );
        // Fall through to the main try/catch which will handle this if JWT() is called.
    }
    if (typeof GoogleSpreadsheet !== 'function') {
        console.error(
            '[submit-order] CRITICAL FAILURE: GoogleSpreadsheet is not a function. Check google-spreadsheet import and installation.'
        );
        // Fall through.
    }

    if (req.method === 'OPTIONS') {
        console.log('[submit-order] Handling OPTIONS preflight request.');
        let optionsResponse = new Response(null, { status: 204 });
        setCorsHeaders(optionsResponse);
        return optionsResponse;
    }

    if (req.method !== 'POST') {
        console.log(`[submit-order] Method not allowed: ${req.method}`);
        let methodNotAllowedResponse = new Response(
            JSON.stringify({ error: 'Method Not Allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(methodNotAllowedResponse);
        return methodNotAllowedResponse;
    }

    console.log('[submit-order] Processing POST request.');

    try {
        const orderData = await req.json();
        console.log(
            '[submit-order] Received orderData:',
            JSON.stringify(orderData, null, 2)
        );

        // --- Environment Variable Check ---
        console.log('[submit-order] Checking environment variables...');
        const requiredEnvVars = [
            'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_PRIVATE_KEY',
            'GOOGLE_SHEET_ID'
        ];
        const missingEnvVars = requiredEnvVars.filter(
            (envVar) => !process.env[envVar]
        );

        if (missingEnvVars.length > 0) {
            console.error(
                `[submit-order] CRITICAL: Missing environment variables: ${missingEnvVars.join(
                    ', '
                )}`
            );
            let configErrorResponse = new Response(
                JSON.stringify({
                    error: 'Server configuration error. Necessary credentials missing.'
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            setCorsHeaders(configErrorResponse);
            return configErrorResponse;
        }
        console.log('[submit-order] Environment variables seem present.');

        // --- Google Sheets Authentication ---
        console.log('[submit-order] Authenticating with Google Sheets...');
        // CRITICAL POINT: If JWT is undefined, `new JWT()` will throw "TypeError: JWT is not a constructor" (or minified "v is not a function").
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Correctly handles escaped newlines
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        console.log('[submit-order] JWT auth object created.');

        // CRITICAL POINT: If GoogleSpreadsheet is undefined, this will also throw a TypeError.
        const doc = new GoogleSpreadsheet(
            process.env.GOOGLE_SHEET_ID,
            serviceAccountAuth
        );
        console.log(
            `[submit-order] GoogleSpreadsheet object created for sheet ID: ${process.env.GOOGLE_SHEET_ID}`
        );

        await doc.loadInfo(); // Authenticates and loads properties
        console.log(
            '[submit-order] Google Sheet info loaded. Title:',
            doc.title
        );

        const sheet = doc.sheetsByIndex[0]; // Assuming the first sheet
        if (!sheet) {
            const availableSheetTitles =
                Object.values(doc.sheetsByTitle)
                    .map((s) => s.title)
                    .join(', ') || 'No sheets found by title';
            console.error(
                `[submit-order] Google Sheet not found at index 0. Available sheet titles: ${availableSheetTitles}`
            );
            let sheetErrorResponse = new Response(
                JSON.stringify({
                    error: 'Spreadsheet configuration error on server (sheet not found at index 0).'
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            setCorsHeaders(sheetErrorResponse);
            return sheetErrorResponse;
        }
        console.log(
            '[submit-order] Target sheet loaded. Title:',
            sheet.title,
            'Row count:',
            sheet.rowCount
        );

        // --- Prepare Data ---
        const newRow = {
            Timestamp: new Date().toISOString(),
            Name: orderData.name,
            Email: orderData.email || '', // Defaults to empty string if email is undefined/null
            PhoneNumber: orderData.phoneNumber,
            BurritoOrders: JSON.stringify(orderData.burritoOrders), // Storing as JSON string
            Preferences: orderData.preferences || '' // Defaults to empty string if preferences is undefined/null
        };
        console.log(
            '[submit-order] Prepared new row data:',
            JSON.stringify(newRow, null, 2)
        );

        // --- Add Row ---
        console.log('[submit-order] Attempting to add row to sheet...');
        await sheet.addRow(newRow);
        console.log('[submit-order] Row successfully added to sheet.');

        let successResponse = new Response(
            JSON.stringify({ message: 'Order submitted successfully!' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(successResponse);
        console.log('[submit-order] Sending success response to client.');
        return successResponse;
    } catch (error) {
        console.error(
            '[submit-order] Error processing order in Netlify Function:',
            error.message // Log the message
        );
        if (error.stack) {
            console.error('[submit-order] Error stack:', error.stack); // Log the stack for more details
        }
        // Optionally log the error object itself if it might contain more info
        // console.error('[submit-order] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

        let errorResponse = new Response(
            JSON.stringify({
                error: 'Failed to process order due to a server issue.',
                details: error.message // Provide the error message to the client for debugging
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(errorResponse);
        console.log('[submit-order] Sending error response to client.');
        return errorResponse;
    }
};
