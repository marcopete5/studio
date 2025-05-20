// netlify/functions/submit-order.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Initial typeof checks (good to have at the top level)
console.log(
    '[submit-order] Initial typeof GoogleSpreadsheet:',
    typeof GoogleSpreadsheet
);
console.log('[submit-order] Initial typeof JWT:', typeof JWT);
if (typeof GoogleSpreadsheet !== 'function') {
    // This log helps confirm if the import itself is the problem at the module level
    console.error(
        '[submit-order] FATAL: GoogleSpreadsheet is NOT a function immediately after import!'
    );
}
if (typeof JWT !== 'function') {
    // This log helps confirm if the import itself is the problem at the module level
    console.error(
        '[submit-order] FATAL: JWT is NOT a function immediately after import!'
    );
}

const setCorsHeaders = (response) => {
    response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.ALLOWED_ORIGIN || '*' // Be more specific in production
    );
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export default async (req, context) => {
    console.log(
        '[submit-order] Netlify Function handler started. Method:',
        req.method
    );

    // Handle OPTIONS preflight request for CORS
    if (req.method === 'OPTIONS') {
        console.log('[submit-order] Handling OPTIONS preflight request.');
        let optionsResponse = new Response(null, { status: 204 });
        return setCorsHeaders(optionsResponse); // Apply CORS headers
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        console.log(`[submit-order] Method not allowed: ${req.method}`);
        let methodNotAllowedResponse = new Response(
            JSON.stringify({ error: 'Method Not Allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
        return setCorsHeaders(methodNotAllowedResponse); // Apply CORS headers
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
            const errorMsg = `CRITICAL: Missing environment variables: ${missingEnvVars.join(
                ', '
            )}`;
            console.error(`[submit-order] ${errorMsg}`);
            let configErrorResponse = new Response(
                JSON.stringify({
                    error: 'Server configuration error. Necessary credentials missing.',
                    details: errorMsg
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            return setCorsHeaders(configErrorResponse);
        }
        console.log('[submit-order] Environment variables seem present.');

        // --- Google Sheets Authentication & Interaction ---
        let serviceAccountAuth;
        console.log('[submit-order] Attempting to instantiate JWT...');
        if (typeof JWT !== 'function') {
            // Re-check type right before instantiation
            const errMsg =
                'JWT is not a constructor function before instantiation!';
            console.error(`[submit-order] ERROR: ${errMsg}`);
            // This specific error helps isolate if JWT became undefined/wrong type by this point
            let jwtErrorResponse = new Response(
                JSON.stringify({
                    error: 'Server Auth Setup Error (JWT)',
                    details: errMsg
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            return setCorsHeaders(jwtErrorResponse);
        }
        serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        console.log('[submit-order] JWT auth object CREATED successfully.');

        let doc;
        console.log(
            '[submit-order] Attempting to instantiate GoogleSpreadsheet...'
        );
        if (typeof GoogleSpreadsheet !== 'function') {
            // Re-check type right before instantiation
            const errMsg =
                'GoogleSpreadsheet is not a constructor function before instantiation!';
            console.error(`[submit-order] ERROR: ${errMsg}`);
            let gsErrorResponse = new Response(
                JSON.stringify({
                    error: 'Server Auth Setup Error (GS)',
                    details: errMsg
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            return setCorsHeaders(gsErrorResponse);
        }
        doc = new GoogleSpreadsheet(
            process.env.GOOGLE_SHEET_ID,
            serviceAccountAuth
        );
        console.log(
            '[submit-order] GoogleSpreadsheet object CREATED successfully.'
        );

        console.log('[submit-order] Attempting doc.loadInfo()...');
        await doc.loadInfo(); // Authenticates and loads properties
        console.log(
            '[submit-order] Google Sheet info loaded. Title:',
            doc.title
        );

        const sheet = doc.sheetsByIndex[0];
        if (!sheet) {
            const availableSheetTitles =
                Object.values(doc.sheetsByTitle)
                    .map((s) => s.title)
                    .join(', ') || 'No sheets found';
            const errorMsg = `Google Sheet not found at index 0. Available: ${availableSheetTitles}`;
            console.error(`[submit-order] ${errorMsg}`);
            let sheetErrorResponse = new Response(
                JSON.stringify({
                    error: 'Spreadsheet configuration error.',
                    details: errorMsg
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            return setCorsHeaders(sheetErrorResponse);
        }
        console.log(
            '[submit-order] Target sheet loaded. Title:',
            sheet.title,
            'Row count:',
            sheet.rowCount
        );

        // --- Prepare Data for Sheet ---
        const newRow = {
            Timestamp: new Date().toISOString(),
            Name: orderData.name,
            Email: orderData.email || '',
            PhoneNumber: orderData.phoneNumber,
            BurritoOrders: JSON.stringify(orderData.burritoOrders),
            Preferences: orderData.preferences || '' // Ensure this matches your sheet header
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
        return setCorsHeaders(successResponse);
    } catch (error) {
        console.error(
            '[submit-order] Error caught in main try/catch block:',
            error.message
        );
        if (error.stack) {
            console.error('[submit-order] Stack trace:', error.stack);
        }
        let errorResponse = new Response(
            JSON.stringify({
                error: 'Failed to process order due to a server issue.',
                details: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
        return setCorsHeaders(errorResponse);
    }
};
