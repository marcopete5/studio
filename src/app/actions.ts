 "use server";

import { z } from "zod";
// import { sendSms } from "@/services/sms"; // Removed SMS service import
import { appendToSheet, type SubmissionData } from "@/services/sheets";

// Define available burritos (just names, prices are display only)
const burritoTypes = [
    "Bean & Cheese Burrito",
    "Beef & Bean Burrito",
    "Burrito of the Week*",
];

// Define the schema for form validation using Zod
const burritoOrderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phoneNumber: z.string()
    .min(1, "Phone number is required")
    .regex(/^\+1\d{10}$/, "Phone number must be in +1XXXXXXXXXX format."), // Updated regex
  // Use a record to store burrito types and their quantities
  // Ensure keys are within the defined burrito types
  burritoOrders: z.record(z.enum(burritoTypes as [string, ...string[]]), z.number().min(1, "Quantity must be at least 1"))
    .refine(orders => Object.keys(orders).length > 0, {
      message: "Please select at least one burrito.",
    }),
});

export type FormState = {
  message: string;
  errors?: {
    name?: string[];
    email?: string[];
    phoneNumber?: string[];
    burritoOrders?: string[];
    _form?: string[];
  };
  success: boolean;
};

// Define recipient phone number and sheet ID (replace with actual values)
// const RECIPIENT_PHONE_NUMBER = process.env.NOTIFICATION_PHONE_NUMBER || "+15551234567"; // Removed, SMS functionality disabled
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || "1o8tUcElSAWOm0HNlNTHXfytCbcMe_8eRPMav6uscicw"; // Replace with your Google Sheet ID or use env var

export async function submitBurritoOrder(
  prevState: FormState | undefined,
  formData: FormData
): Promise<FormState> {
  const rawFormData: { [key: string]: unknown } = {
    name: formData.get("name"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    burritoOrders: {},
  };

  // Extract burrito orders and quantities from formData
  for (const burritoType of burritoTypes) {
    const quantityKey = `quantity-${burritoType}`;
    if (formData.has(quantityKey)) {
        const quantity = formData.get(quantityKey);
        if (quantity && Number(quantity) > 0) {
             (rawFormData.burritoOrders as Record<string, number>)[burritoType] = Number(quantity);
        }
    }
  }


  // Validate form data
  const validatedFields = burritoOrderSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    console.log("Validation Errors:", validatedFields.error.flatten().fieldErrors);
    // Map Zod errors to FormState structure
     const fieldErrors = validatedFields.error.flatten().fieldErrors;
     const errors: FormState['errors'] = {};
     if (fieldErrors.name) errors.name = fieldErrors.name;
     if (fieldErrors.email) errors.email = fieldErrors.email;
     if (fieldErrors.phoneNumber) errors.phoneNumber = fieldErrors.phoneNumber;
     // Handle potential refinement error for burritoOrders
     if (fieldErrors.burritoOrders) errors.burritoOrders = fieldErrors.burritoOrders;
     // Handle form-level errors (e.g., refinement errors on the whole object)
     if (validatedFields.error.formErrors.length > 0) {
        errors._form = validatedFields.error.formErrors;
     }


    return {
      message: "Validation failed. Please check your entries.",
      errors: errors,
      success: false,
    };
  }

  const { name, email, phoneNumber, burritoOrders } = validatedFields.data;

  // Prepare submission data
  const submission: SubmissionData = {
    name,
    email: email || undefined, // Ensure email is undefined if empty
    phoneNumber,
    burritoOrders,
  };

  // SMS message preparation removed
  // const orderDetails = Object.entries(burritoOrders)
  //   .map(([type, quantity]) => `${type}: ${quantity}`)
  //   .join(", ");
  // const smsMessage = `New Burrito Order!\nName: ${name}\nPhone: ${phoneNumber}${email ? `\nEmail: ${email}` : ''}\nOrder: ${orderDetails}`;

  try {
    // Send SMS notification - REMOVED
    // await sendSms(RECIPIENT_PHONE_NUMBER, smsMessage);
    // console.log("SMS Sent Successfully");

    // Append data to Google Sheet
    if (!GOOGLE_SHEET_ID) {
        console.error("Google Sheet ID is not configured. Skipping append operation.");
        throw new Error("Google Sheet ID is not configured.");
    }
    await appendToSheet(submission, GOOGLE_SHEET_ID);
    console.log("Data Appended to Sheet Successfully");

    return { message: "Order submitted successfully! Data sent to Google Sheet.", success: true };
  } catch (error) {
    console.error("Submission Error:", error);
    let errorMessage = "An unexpected error occurred during submission.";
    if (error instanceof Error) {
      errorMessage = `Submission failed: ${error.message}`;
    }
    return {
      message: errorMessage,
      errors: { _form: [errorMessage] },
      success: false,
     };
  }
}
