// 'use client'; // Keep this if it's at the top of your file

import { z } from 'zod'; // Assuming Zod is imported if not already

// Define available burritos (just names, prices are display only)
const burritoTypes = [
    'Bean & Cheese Burrito',
    'Beef & Bean Burrito',
    'Burrito of the Week*'
];

// Define the schema for form validation using Zod
const burritoOrderSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z
        .string()
        .email('Invalid email address')
        .optional()
        .or(z.literal('')),
    phoneNumber: z
        .string()
        .min(1, 'Phone number is required')
        .regex(/^\+1\d{10}$/, 'Phone number must be in +1XXXXXXXXXX format.'),
    burritoOrders: z
        .record(
            z.enum(burritoTypes as [string, ...string[]]), // Ensures burritoTypes is correctly typed for z.enum
            z.number().min(1, 'Quantity must be at least 1')
        )
        .refine((orders) => Object.keys(orders).length > 0, {
            message: 'Please select at least one burrito.'
        })
});

export type FormState = {
    message: string;
    errors?: {
        name?: string[];
        email?: string[];
        phoneNumber?: string[];
        burritoOrders?: string[]; // This was for the record, individual burrito errors might be different
        _form?: string[]; // General form errors
    };
    success: boolean;
};

export async function submitBurritoOrder(
    prevState: FormState | undefined,
    formData: FormData
): Promise<FormState> {
    const rawFormData: { [key: string]: unknown } = {
        name: formData.get('name'),
        email: formData.get('email'),
        phoneNumber: formData.get('phoneNumber'),
        burritoOrders: {} // Initialize as an empty object
    };

    // Extract burrito orders and quantities from formData
    for (const burritoType of burritoTypes) {
        const quantityKey = `quantity-${burritoType}`; // Construct key like "quantity-Bean & Cheese Burrito"
        if (formData.has(quantityKey)) {
            const quantityValue = formData.get(quantityKey);
            // Ensure quantityValue is not null and is a valid number string before converting
            if (
                quantityValue &&
                !isNaN(Number(quantityValue)) &&
                Number(quantityValue) > 0
            ) {
                (rawFormData.burritoOrders as Record<string, number>)[
                    burritoType
                ] = Number(quantityValue);
            }
        }
    }

    // Validate form data
    // THIS IS THE CRUCIAL LINE THAT DEFINES validatedFields
    const validatedFields = burritoOrderSchema.safeParse(rawFormData);

    // Check if validation was successful
    if (!validatedFields.success) {
        console.error(
            // Changed to console.error for better visibility
            'Validation Errors:',
            validatedFields.error.flatten().fieldErrors
        );
        // Ensure all potential field errors from Zod are mapped
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const errors: FormState['errors'] = {
            name: fieldErrors.name,
            email: fieldErrors.email,
            phoneNumber: fieldErrors.phoneNumber,
            burritoOrders: fieldErrors.burritoOrders, // This captures errors related to the burritoOrders object itself
            _form:
                validatedFields.error.formErrors.length > 0
                    ? validatedFields.error.formErrors
                    : undefined
        };

        return {
            message: 'Validation failed. Please check your entries.',
            errors: errors,
            success: false
        };
    }

    // If validation is successful, validatedFields.data will contain the typed data
    const { name, email, phoneNumber, burritoOrders } = validatedFields.data;

    // Prepare submission data
    const submission = {
        name,
        email: email || undefined, // Ensure email is undefined if empty, not just an empty string if that's preferred
        phoneNumber,
        burritoOrders
    };

    try {
        // Define the absolute URL of your deployed Netlify Function
        const netlifyFunctionUrl =
            'https://marcos-burritos.netlify.app/.netlify/functions/submit-order';

        // Send data to your Netlify Function
        const response = await fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });

        if (!response.ok) {
            let errorResponseMessage = 'Failed to submit order to API.';
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorResponseMessage = errorData.error;
                } else if (errorData && errorData.message) {
                    errorResponseMessage = errorData.message;
                } else {
                    errorResponseMessage = `Server responded with ${response.status}: ${response.statusText}`;
                }
            } catch (e) {
                errorResponseMessage = `Server responded with ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorResponseMessage);
        }

        const result = await response.json();

        return {
            message: result.message || 'Order submitted successfully!',
            success: true
        };
    } catch (error) {
        console.error('Submission Error:', error);
        let errorMessage = 'An unexpected error occurred during submission.';
        if (error instanceof Error) {
            errorMessage = `Submission failed: ${error.message}`;
        }
        return {
            message: errorMessage,
            errors: { _form: [errorMessage] },
            success: false
        };
    }
}
