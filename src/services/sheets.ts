
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Interface for submission data remains the same
export interface SubmissionData {
 name: string;
 email?: string; // Optional email
 phoneNumber: string;
 burritoOrders: { [burritoType: string]: number }; // Record for burrito types and quantities
}


const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Ensure backslashes in the private key from the env var are replaced with newlines
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');


// Initialize Google Sheets API client
async function getGoogleSheetClient() {
 // Check if credentials are provided
 if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
   console.warn('Google Sheets credentials missing or incomplete in environment variables. Cannot initialize client.');
   return null; // Return null if credentials are not sufficient
 }

  // Diagnostic log for the private key format
  // WARNING: Be cautious with logging sensitive information. This logs only a snippet.
  if (GOOGLE_PRIVATE_KEY) {
    const keySnippetStart = GOOGLE_PRIVATE_KEY.substring(0, 40);
    const keySnippetEnd = GOOGLE_PRIVATE_KEY.substring(GOOGLE_PRIVATE_KEY.length - 40);
    console.log('[DEBUG] Processed GOOGLE_PRIVATE_KEY (snippet check):');
    console.log(`  Starts with: "${keySnippetStart}..."`);
    console.log(`  Ends with:   "...${keySnippetEnd}"`);
    console.log(`  Length: ${GOOGLE_PRIVATE_KEY.length}`);
    console.log(`  Includes '-----BEGIN PRIVATE KEY-----': ${GOOGLE_PRIVATE_KEY.includes("-----BEGIN PRIVATE KEY-----")}`);
    console.log(`  Includes '-----END PRIVATE KEY-----': ${GOOGLE_PRIVATE_KEY.includes("-----END PRIVATE KEY-----")}`);
  } else {
    console.warn('[DEBUG] GOOGLE_PRIVATE_KEY is undefined after processing.');
  }

 const auth = new JWT({
   email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
   key: GOOGLE_PRIVATE_KEY,
   scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Scope required for Sheets API
 });

 const sheets = google.sheets({ version: 'v4', auth });
 return sheets;
}

/**
 * Appends a submission to a specified Google Sheet using the Google Sheets API.
 *
 * @param submission The submission data to append.
 * @param sheetId The ID of the Google Sheet to append to (retrieved from environment variables).
 * @returns A promise that resolves when the data is successfully appended.
 * @throws Will throw an error if credentials are missing or the API call fails.
 */
export async function appendToSheet(submission: SubmissionData, sheetId: string): Promise<void> {
 const sheets = await getGoogleSheetClient();

 if (!sheets) {
   console.error('Failed to initialize Google Sheets client. Skipping append operation.');
   // Optionally throw an error or return a specific status
   // throw new Error('Google Sheets client not initialized.');
   return; // Exit if client couldn't be initialized
 }

 try {
   console.log(`Attempting to append data to Google Sheet ID: ${sheetId}...`);

   // Validate submission data (basic check)
   if (!submission || !submission.name || !submission.phoneNumber || !submission.burritoOrders) {
     throw new Error("Invalid or incomplete submission data provided.");
   }

   // Format data for appending
   const timestamp = new Date().toISOString();
   const orderDetails = Object.entries(submission.burritoOrders)
     .map(([type, quantity]) => `${type} (${quantity})`)
     .join(", ");

   // Prepare the row data in the order you want columns in the sheet
   // Example: Timestamp, Name, Email, Phone, Order Details
   const values = [[
     timestamp,
     submission.name,
     submission.email || '', // Use empty string if email is optional and not provided
     submission.phoneNumber,
     orderDetails,
   ]];

   // Append data to the sheet (assuming data starts at A1)
   // Adjust 'Sheet1!A1' if your sheet name or starting cell is different.
   const range = 'Sheet1'; // Default sheet name. Change if necessary.
   await sheets.spreadsheets.values.append({
     spreadsheetId: sheetId,
     range: range, // Appends after the last row with data in this range
     valueInputOption: 'USER_ENTERED', // Interprets data like formulas if entered, otherwise as strings
     insertDataOption: 'INSERT_ROWS', // Inserts new rows for the data
     requestBody: {
       values: values,
     },
   });

   console.log(`Data appended to Google Sheet (ID: ${sheetId}) successfully.`);

 } catch (error) {
   console.error('Error appending data to Google Sheet:', error);
   // Rethrow the error to be caught by the calling function (e.g., the server action)
   throw new Error(`Failed to append data to Google Sheet: ${error instanceof Error ? error.message : String(error)}`);
 }
}
