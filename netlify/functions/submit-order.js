// netlify/functions/submit-order.js

// We'll use the 'google-spreadsheet' package to interact with Google Sheets.
// Make sure to install it in your project: npm install google-spreadsheet
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Helper function to set CORS headers
// This allows your frontend (on GitHub Pages) to call this function
const setCorsHeaders = (response) => {
    response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.ALLOWED_ORIGIN || '*'
    ); // Be more specific in production
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export default async (req, context) => {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        let optionsResponse = new Response(null, { status: 204 }); // No Content
        setCorsHeaders(optionsResponse);
        return optionsResponse;
    }

    // Only allow POST requests for actual submissions
    if (req.method !== 'POST') {
        let methodNotAllowedResponse = new Response(
            JSON.stringify({ error: 'Method Not Allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(methodNotAllowedResponse);
        return methodNotAllowedResponse;
    }

    try {
        const orderData = await req.json(); // Get data from the request body

        // --- Google Sheets Authentication and Setup ---
        // Ensure these environment variables are set in your Netlify site settings
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const doc = new GoogleSpreadsheet(
            process.env.GOOGLE_SHEET_ID,
            serviceAccountAuth
        );
        await doc.loadInfo(); // Loads document properties and worksheets

        // Assuming your sheet is the first one (index 0)
        // You can also access sheets by title: await doc.sheetsByTitle['Your Sheet Name'];
        const sheet = doc.sheetsByIndex[0];
        if (!sheet) {
            console.error('Google Sheet not found (index 0).');
            let sheetErrorResponse = new Response(
                JSON.stringify({
                    error: 'Spreadsheet configuration error on server.'
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
            setCorsHeaders(sheetErrorResponse);
            return sheetErrorResponse;
        }

        // --- Prepare Data for Google Sheet ---
        // Customize this based on your sheet's column order
        const newRow = {
            Timestamp: new Date().toISOString(),
            Name: orderData.name,
            Email: orderData.email || '', // Handle optional email
            PhoneNumber: orderData.phoneNumber,
            // Convert burritoOrders object to a string for simplicity,
            // or you can map each burrito to its own column.
            BurritoOrders: JSON.stringify(orderData.burritoOrders)
            // Example: If you have columns for each burrito type:
            // 'Bean & Cheese Burrito': orderData.burritoOrders['Bean & Cheese Burrito'] || 0,
            // 'Beef & Bean Burrito': orderData.burritoOrders['Beef & Bean Burrito'] || 0,
            // 'Burrito of the Week*': orderData.burritoOrders['Burrito of the Week*'] || 0,
        };

        // --- Add Row to Google Sheet ---
        await sheet.addRow(newRow);

        let successResponse = new Response(
            JSON.stringify({
                message: 'Order submitted successfully to Netlify Function!'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(successResponse);
        return successResponse;
    } catch (error) {
        console.error('Error processing order:', error);
        let errorResponse = new Response(
            JSON.stringify({
                error: 'Failed to process order.',
                details: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
        setCorsHeaders(errorResponse);
        return errorResponse;
    }
};
