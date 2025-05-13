// 'use client'; // Keep this if it's at the top of your file

// ... (all your existing Zod schemas, types, and initial formData processing logic remains the same) ...

export async function submitBurritoOrder(
    prevState: FormState | undefined,
    formData: FormData
): Promise<FormState> {
    // ... (your existing rawFormData extraction and validation logic remains the same) ...
    // Ensure validatedFields check and return for errors is here

    if (!validatedFields.success) {
        // ... (your existing error handling for validation) ...
        return {
            message: 'Validation failed. Please check your entries.',
            errors: validatedFields.error.flatten()
                .fieldErrors as FormState['errors'], // Be explicit with type if needed
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
        // Define the absolute URL of your deployed Netlify Function
        const netlifyFunctionUrl =
            'https://marcos-burritos.netlify.app/.netlify/functions/submit-order'; // <--- YOUR NETLIFY FUNCTION URL

        // Send data to your Netlify Function
        const response = await fetch(netlifyFunctionUrl, {
            // <--- USE THE NEW URL HERE
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });

        if (!response.ok) {
            // Try to get more specific error message from the function's response if possible
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
                // Could not parse JSON, use status text
                errorResponseMessage = `Server responded with ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorResponseMessage);
        }

        // Assuming your Netlify function returns JSON with a message property on success
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
