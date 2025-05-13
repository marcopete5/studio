// netlify/functions/submit-order.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const setCorsHeaders = (response) => {
    response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.ALLOWED_ORIGIN || '*'
    );
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export default async (req, context) => {
    console.log('[submit-order] Function invoked. Method:', req.method);

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
        if (
            !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
            !process.env.GOOGLE_PRIVATE_KEY ||
            !process.env.GOOGLE_SHEET_ID
        ) {
            console.error(
                '[submit-order] CRITICAL: Missing Google Sheets API credentials or Sheet ID in environment variables.'
            );
            // ... (logging for individual env vars)
            let configErrorResponse = new Response(
                JSON.stringify({
                    error: 'Server configuration error. Please contact support.'
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            setCorsHeaders(configErrorResponse);
            return configErrorResponse;
        }
        console.log('[submit-order] Environment variables seem present.');

        // --- Google Sheets Authentication ---
        console.log('[submit-order] Authenticating with Google Sheets...');
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        console.log('[submit-order] JWT auth object created.');

        const doc = new GoogleSpreadsheet(
            process.env.GOOGLE_SHEET_ID,
            serviceAccountAuth
        );
        console.log(
            `[submit-order] Attempting to load Google Sheet with ID: ${process.env.GOOGLE_SHEET_ID}`
        );
        await doc.loadInfo();
        console.log(
            '[submit-order] Google Sheet info loaded. Title:',
            doc.title
        );

        const sheet = doc.sheetsByIndex[0];
        if (!sheet) {
            console.error(
                `[submit-order] Google Sheet not found at index 0. Available sheet titles: ${Object.keys(
                    doc.sheetsByTitle
                ).join(', ')}`
            );
            let sheetErrorResponse = new Response(
                JSON.stringify({
                    error: 'Spreadsheet configuration error on server (sheet not found).'
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
            Email: orderData.email || '',
            PhoneNumber: orderData.phoneNumber,
            BurritoOrders: JSON.stringify(orderData.burritoOrders),
            Preferences: orderData.preferences || '' // <-- CORRECTED: Use the string directly, or empty if undefined
        };
        console.log(
            '[submit-order] Prepared new row data:',
            JSON.stringify(newRow, null, 2) // This log will now show Preferences correctly
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
            error
        );
        if (error.stack) {
            console.error('[submit-order] Error stack:', error.stack);
        }
        let errorResponse = new Response(
            JSON.stringify({
                error: 'Failed to process order due to a server issue.',
                details: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(errorResponse);
        console.log('[submit-order] Sending error response to client.');
        return errorResponse;
    }
};
