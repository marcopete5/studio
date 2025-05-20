// src/app/actions.ts
'use client';

import { z } from 'zod';

const burritoTypes = [
    'Bean & Cheese Burrito',
    'Beef & Bean Burrito',
    'Burrito of the Week*'
];

// Updated schema for form validation
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
            z.enum(burritoTypes as [string, ...string[]]),
            z.number().min(1, 'Quantity must be at least 1')
        )
        .refine((orders) => Object.keys(orders).length > 0, {
            message: 'Please select at least one burrito.'
        }),
    preferences: z.string().optional() // Added preferences field
});

export type FormState = {
    message: string;
    errors?: {
        name?: string[];
        email?: string[];
        phoneNumber?: string[];
        burritoOrders?: string[];
        preferences?: string[]; // Added for preferences errors
        _form?: string[];
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
        preferences: formData.get('preferences') || '', // Get preferences, default to empty string if not present
        burritoOrders: {}
    };

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
            preferences: fieldErrors.preferences, // Include preferences errors
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

    const { name, email, phoneNumber, burritoOrders, preferences } =
        validatedFields.data; // Destructure preferences

    const submission = {
        name,
        email: email || undefined, // Send undefined if empty, so JSON.stringify might omit it
        phoneNumber,
        burritoOrders,
        preferences: preferences || undefined // Send undefined if empty
    };

    try {
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
