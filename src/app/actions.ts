'use client';

import { z } from 'zod';

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
            z.enum(burritoTypes as [string, ...string[]]),
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
        burritoOrders?: string[];
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
        burritoOrders: {}
    };

    // Extract burrito orders and quantities from formData
    for (const burritoType of burritoTypes) {
        const quantityKey = `quantity-${burritoType}`;
        if (formData.has(quantityKey)) {
            const quantity = formData.get(quantityKey);
            if (quantity && Number(quantity) > 0) {
                (rawFormData.burritoOrders as Record<string, number>)[
                    burritoType
                ] = Number(quantity);
            }
        }
    }

    // Validate form data
    const validatedFields = burritoOrderSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
        console.log(
            'Validation Errors:',
            validatedFields.error.flatten().fieldErrors
        );
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const errors: FormState['errors'] = {};
        if (fieldErrors.name) errors.name = fieldErrors.name;
        if (fieldErrors.email) errors.email = fieldErrors.email;
        if (fieldErrors.phoneNumber)
            errors.phoneNumber = fieldErrors.phoneNumber;
        if (fieldErrors.burritoOrders)
            errors.burritoOrders = fieldErrors.burritoOrders;
        if (validatedFields.error.formErrors.length > 0) {
            errors._form = validatedFields.error.formErrors;
        }

        return {
            message: 'Validation failed. Please check your entries.',
            errors: errors,
            success: false
        };
    }

    const { name, email, phoneNumber, burritoOrders } = validatedFields.data;

    // Prepare submission data
    const submission = {
        name,
        email: email || undefined,
        phoneNumber,
        burritoOrders
    };

    try {
        // Send data to an external API endpoint
        const response = await fetch('/api/submit-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });

        if (!response.ok) {
            throw new Error('Failed to submit order to API');
        }

        return {
            message: 'Order submitted successfully!',
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
