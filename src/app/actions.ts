// src/app/actions.ts
// This file is for client-side actions that run in the browser.

'use client'; // Important for Next.js App Router if this is a Server Action
// or if it's used by client components.

import { z } from 'zod';

// Define available burritos (must match what the form generates)
const burritoTypes = [
    'Bean & Cheese Burrito',
    'Beef & Bean Burrito',
    'Burrito of the Week*'
];

// Define the schema for form validation using Zod
// This should be the same schema as used in your form component
const burritoOrderSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z
        .string()
        .email('Invalid email address')
        .optional()
        .or(z.literal('')), // Allows empty string or valid email
    phoneNumber: z
        .string()
        .min(1, 'Phone number is required')
        .regex(/^\+1\d{10}$/, 'Phone number must be in +1XXXXXXXXXX format.'),
    burritoOrders: z
        .record(
            z.enum(burritoTypes as [string, ...string[]]),
            z.number().min(1, 'Quantity must be at least 1')
        )
        .refine((orders) => Object.keys(orders).length > 0, {
            message: 'Please select at least one burrito.'
        })
});

// This type defines the shape of the state object returned by the action
export type FormState = {
    message: string;
    errors?: {
        name?: string[];
        email?: string[];
        phoneNumber?: string[];
        burritoOrders?: string[]; // For errors on the burritoOrders object itself
        _form?: string[]; // For general form errors
    };
    success: boolean;
};

// This is the function that will be called by your form.
// It runs on the client-side and calls your Netlify serverless function.
export async function submitBurritoOrder(
    prevState: FormState | undefined, // prevState is often used with useFormState hook
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
        const quantityKey = `quantity-${burritoType}`;
        if (formData.has(quantityKey)) {
            const quantityValue = formData.get(quantityKey);
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

    // Validate form data using Zod
    const validatedFields = burritoOrderSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        console.error(
            'Validation Errors (Frontend):',
            validatedFields.error.flatten().fieldErrors
        );
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const errors: FormState['errors'] = {
            name: fieldErrors.name,
            email: fieldErrors.email,
            phoneNumber: fieldErrors.phoneNumber,
            burritoOrders: fieldErrors.burritoOrders,
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

    // If validation is successful, validatedFields.data contains the typed data
    const { name, email, phoneNumber, burritoOrders } = validatedFields.data;

    const submission = {
        name,
        email: email || undefined,
        phoneNumber,
        burritoOrders
    };

    try {
        // This is the URL of your deployed Netlify Function
        const netlifyFunctionUrl =
            'https://marcos-burritos.netlify.app/.netlify/functions/submit-order';

        const response = await fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });

        if (!response.ok) {
            let errorResponseMessage = 'Failed to submit order via API.';
            try {
                const errorData = await response.json();
                if (errorData && (errorData.error || errorData.message)) {
                    errorResponseMessage = errorData.error || errorData.message;
                } else {
                    errorResponseMessage = `Server responded with ${response.status}: ${response.statusText}`;
                }
            } catch (e) {
                // Could not parse JSON, use status text
                errorResponseMessage = `Server responded with ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorResponseMessage);
        }

        const result = await response.json(); // Expecting { message: "some success message" }

        return {
            message: result.message || 'Order submitted successfully!',
            success: true
        };
    } catch (error) {
        console.error('Submission Error (Frontend):', error);
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
