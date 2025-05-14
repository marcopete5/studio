// src/components/burrito-order-form.tsx
'use client';

import React, { useEffect, useTransition, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

// Assuming these are correctly imported from your project structure
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormControl
} from '@/components/ui/form';
import { Loader2, Utensils } from 'lucide-react';
import { submitBurritoOrder, type FormState } from '@/app/actions'; // Ensure this path is correct
import { useToast } from '@/hooks/use-toast'; // Ensure this path is correct

import { useFormState } from 'react-dom'; // Removed useFormStatus as it's not used directly

// Schema for client-side validation
const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z
        .string()
        .email('Invalid email address')
        .optional()
        .or(z.literal('')), // Allows empty string
    phoneNumber: z
        .string()
        .min(1, 'Phone number is required')
        .regex(/^\+1\d{10}$/, 'Phone number must be in +1XXXXXXXXXX format.'),
    selectedBurritos: z
        .array(z.string())
        .min(1, 'Please select at least one burrito.'),
    preferences: z.string().optional() // Allows undefined, but defaultValues will make it ''
});

// Burrito options with prices
const burritoOptions = [
    'Bean & Cheese Burrito - $5',
    'Beef & Bean Burrito - $6',
    'Burrito of the Week* - $10'
];

interface SubmitButtonProps {
    isPending: boolean;
}
function SubmitButton({ isPending }: SubmitButtonProps) {
    return (
        <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            aria-live="polite">
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Utensils className="mr-2 h-4 w-4" />
            )}
            {isPending ? 'Submitting...' : 'Place Order'}
        </Button>
    );
}

const normalizePhoneNumber = (value: string): string => {
    if (!value) return '';
    let digits = value.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) {
        if (digits.length > 1 && !digits.startsWith('+1')) {
            digits = '+1' + digits.substring(1);
        }
    } else if (digits.length > 0) {
        if (digits.startsWith('1') && digits.length > 1) {
            digits = '+' + digits;
        } else {
            digits = '+1' + digits;
        }
    }
    const match = digits.match(/^(\+1\d{0,10}).*$/);
    if (match) return match[1];
    if (digits === '+') return '+';
    if (digits === '+1' && value.length <= 2) return '+1';
    return value;
};

export default function BurritoOrderForm() {
    const initialFormState: FormState = {
        message: '',
        errors: {},
        success: false
    };
    const [formActionState, formAction] = useFormState<FormState, FormData>(
        submitBurritoOrder,
        initialFormState
    );
    const [isTransitionPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            email: '', // Correctly initialized to empty string
            phoneNumber: '',
            selectedBurritos: [],
            preferences: '' // Correctly initialized to empty string
        },
        mode: 'onChange' // Or 'onBlur' or 'onSubmit' based on preference
    });

    const watchedSelectedBurritos =
        useWatch({ control: form.control, name: 'selectedBurritos' }) || [];

    const [quantities, setQuantities] = React.useState<{
        [key: string]: number;
    }>({});

    const prevWatchedSelectedBurritosRef = useRef<string[]>();

    useEffect(() => {
        const currentSelected = watchedSelectedBurritos || [];
        const prevSelected = prevWatchedSelectedBurritosRef.current || [];
        const areArraysEqual = (arr1: string[], arr2: string[]) => {
            if (arr1.length !== arr2.length) return false;
            const sortedArr1 = [...arr1].sort();
            const sortedArr2 = [...arr2].sort();
            for (let i = 0; i < sortedArr1.length; i++) {
                if (sortedArr1[i] !== sortedArr2[i]) return false;
            }
            return true;
        };
        if (!areArraysEqual(currentSelected, prevSelected)) {
            setQuantities((prevQuantities) => {
                const newQuantities: { [key: string]: number } = {};
                currentSelected.forEach((burritoName) => {
                    newQuantities[burritoName] =
                        prevQuantities[burritoName] !== undefined &&
                        prevQuantities[burritoName] > 0
                            ? prevQuantities[burritoName]
                            : 1;
                });
                return newQuantities;
            });
        }
        prevWatchedSelectedBurritosRef.current = currentSelected;
    }, [watchedSelectedBurritos]);

    const handleQuantityChange = (
        burritoName: string,
        value: string | number
    ) => {
        let numValue: number;
        if (typeof value === 'string') {
            if (value.trim() === '') {
                numValue = 1;
            } else {
                numValue = parseInt(value, 10);
            }
        } else {
            numValue = value;
        }
        const newQuantity = isNaN(numValue) || numValue < 1 ? 1 : numValue;
        setQuantities((prev) => ({ ...prev, [burritoName]: newQuantity }));
    };

    useEffect(() => {
        if (formActionState?.success) {
            toast({ title: 'Success!', description: formActionState.message });
            form.reset(); // Resets to defaultValues
            setQuantities({}); // Clear quantities
        } else if (
            formActionState?.message &&
            !formActionState.success &&
            formActionState.message !== '' // Ensure there's an actual message
        ) {
            const errorMessage =
                formActionState.errors?._form?.[0] ||
                formActionState.errors?.burritoOrders?.[0] || // Check for specific quantity/order errors
                formActionState.message;
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: errorMessage
            });
            // Set form errors from server action state
            if (formActionState.errors) {
                Object.keys(formActionState.errors).forEach((key) => {
                    const fieldKey = key as keyof z.infer<typeof formSchema>;
                    const errorMessages = formActionState.errors![fieldKey];
                    if (errorMessages && errorMessages.length > 0) {
                        form.setError(fieldKey, {
                            type: 'server',
                            message: errorMessages[0]
                        });
                    }
                });
            }
        }
    }, [formActionState, toast, form]);

    const anySelected = watchedSelectedBurritos.length > 0;

    // This function is called when react-hook-form validation passes
    const onSubmit = (data: z.infer<typeof formSchema>) => {
        const formDataForServer = new FormData();

        // Append name
        formDataForServer.append('name', data.name);

        // Append email - data.email will be a string (empty or valid email)
        // due to defaultValues and Zod schema (.optional().or(z.literal('')))
        formDataForServer.append('email', data.email);

        // Append phone number
        formDataForServer.append('phoneNumber', data.phoneNumber);

        // Append preferences - data.preferences will be a string (empty or with content)
        // due to defaultValues and Zod schema (.optional())
        formDataForServer.append('preferences', data.preferences);

        let hasAtLeastOneQuantity = false;
        // Ensure selectedBurritos is an array before calling forEach
        if (Array.isArray(data.selectedBurritos)) {
            data.selectedBurritos.forEach((burritoNameWithPrice) => {
                const quantity = Math.max(
                    1,
                    quantities[burritoNameWithPrice] || 1
                );
                formDataForServer.append(
                    `quantity-${burritoNameWithPrice.split(' - ')[0]}`, // Make sure key matches server expectation
                    String(quantity)
                );
                hasAtLeastOneQuantity = true;
            });
        }

        if (
            !hasAtLeastOneQuantity &&
            data.selectedBurritos &&
            data.selectedBurritos.length > 0
        ) {
            form.setError('selectedBurritos', {
                type: 'manual',
                message:
                    'Please ensure selected burritos have a valid quantity.'
            });
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description:
                    'Please ensure selected burritos have a valid quantity.'
            });
            return;
        }

        startTransition(() => {
            formAction(formDataForServer);
        });
    };

    // This function is called when react-hook-form validation fails
    const onInvalid = (errors: any) => {
        console.error('Client-side validation errors:', errors); // Log client-side errors
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey && errors[firstErrorKey].message) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: String(errors[firstErrorKey].message)
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please check the form for errors.'
            });
        }
    };

    return (
        <Card className="w-full max-w-lg shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center text-primary">
                    Burrito Order Form
                </CardTitle>
                <CardDescription className="text-center text-muted-foreground mb-4">
                    Pre-orders end Thursday May 15 @ 7am.{' '}
                    {/* Note: Current date is May 14, 2025. This date might need an update. */}
                </CardDescription>
                <div className="text-center border-t border-border pt-4">
                    <p className="text-xs font-medium text-muted-foreground">
                        Burrito of the Week
                    </p>
                    <h2 className="text-xl font-semibold text-primary tracking-tight mt-1">
                        Steak & Charred Pineapple Teriyaki Burrito
                    </h2>
                </div>
            </CardHeader>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)} // Pass onInvalid here
                    className="space-y-0">
                    <CardContent className="space-y-6">
                        {/* Name Field */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Name{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Your Name"
                                            {...field}
                                            aria-required="true"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Email Field */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="your.email@example.com"
                                            {...field} // field.value will be '' if empty due to defaultValues
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        I&apos;ll use this to tell you about
                                        future burritos, no spam I promise.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Phone Number Field */}
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Phone Number{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="tel"
                                            placeholder="+1234567890"
                                            {...field}
                                            onChange={(e) =>
                                                field.onChange(
                                                    normalizePhoneNumber(
                                                        e.target.value
                                                    )
                                                )
                                            }
                                            aria-required="true"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Used to tell you when your order is
                                        ready for pickup. Must be a US number in
                                        the format +1XXXXXXXXXX.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Selected Burritos Field */}
                        <FormField
                            control={form.control}
                            name="selectedBurritos"
                            render={({
                                field: {
                                    onChange,
                                    value: selectedBurritosValue, // Current value from RHF
                                    ...restField
                                }
                            }) => (
                                <FormItem>
                                    <FormLabel>
                                        Which Burrito(s)?{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <div className="space-y-3">
                                            {burritoOptions.map(
                                                (burritoOption) => {
                                                    const fieldId = `checkbox-${burritoOption.replace(
                                                        /\W/g,
                                                        '-'
                                                    )}`;
                                                    const isChecked =
                                                        selectedBurritosValue?.includes(
                                                            burritoOption
                                                        );
                                                    return (
                                                        <div
                                                            key={burritoOption}
                                                            className="flex flex-row items-start space-x-3 space-y-0">
                                                            <Checkbox
                                                                id={fieldId}
                                                                checked={
                                                                    isChecked
                                                                }
                                                                onCheckedChange={(
                                                                    checkedState
                                                                ) => {
                                                                    const currentSelection =
                                                                        selectedBurritosValue ||
                                                                        [];
                                                                    let newSelection;
                                                                    if (
                                                                        checkedState
                                                                    ) {
                                                                        newSelection =
                                                                            [
                                                                                ...currentSelection,
                                                                                burritoOption
                                                                            ];
                                                                    } else {
                                                                        newSelection =
                                                                            currentSelection.filter(
                                                                                (
                                                                                    name
                                                                                ) =>
                                                                                    name !==
                                                                                    burritoOption
                                                                            );
                                                                    }
                                                                    onChange(
                                                                        newSelection
                                                                    );
                                                                    form.trigger(
                                                                        'selectedBurritos'
                                                                    ); // Trigger validation after change
                                                                }}
                                                                aria-labelledby={`label-${burritoOption.replace(
                                                                    /\W/g,
                                                                    '-'
                                                                )}`}
                                                                {...restField} // Spread rest of field props (name, onBlur, ref)
                                                            />
                                                            <Label
                                                                htmlFor={
                                                                    fieldId
                                                                }
                                                                id={`label-${burritoOption.replace(
                                                                    /\W/g,
                                                                    '-'
                                                                )}`}
                                                                className="font-normal cursor-pointer">
                                                                {burritoOption}
                                                            </Label>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage>
                                        {
                                            form.formState.errors
                                                .selectedBurritos?.message
                                        }
                                    </FormMessage>
                                </FormItem>
                            )}
                        />

                        <div className="text-sm text-muted-foreground mt-2">
                            *Burrito of the Week Price will vary weekly based on
                            ingredient cost.
                        </div>

                        {/* Quantity Section */}
                        {anySelected && (
                            <div className="space-y-4 pt-4 border-t border-border transition-all duration-300 ease-in-out">
                                <h3 className="text-md font-semibold text-primary">
                                    Quantity
                                </h3>
                                {watchedSelectedBurritos.map(
                                    (burritoNameWithPrice) => {
                                        const currentQuantity =
                                            quantities[burritoNameWithPrice] ||
                                            1;
                                        return (
                                            <div
                                                key={`quantity-${burritoNameWithPrice}`}
                                                className="flex items-center justify-between space-x-4 animate-in fade-in duration-500">
                                                <Label
                                                    htmlFor={`quantity-input-${burritoNameWithPrice.replace(
                                                        /\W/g,
                                                        '-'
                                                    )}`}
                                                    className="flex-1">
                                                    {burritoNameWithPrice}
                                                </Label>
                                                <div className="flex items-center">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            handleQuantityChange(
                                                                burritoNameWithPrice,
                                                                currentQuantity -
                                                                    1
                                                            )
                                                        }
                                                        disabled={
                                                            currentQuantity <= 1
                                                        }
                                                        aria-label={`Decrease quantity for ${burritoNameWithPrice}`}>
                                                        -
                                                    </Button>
                                                    <Input
                                                        id={`quantity-input-${burritoNameWithPrice.replace(
                                                            /\W/g,
                                                            '-'
                                                        )}`}
                                                        type="number"
                                                        inputMode="numeric"
                                                        min="1"
                                                        value={currentQuantity}
                                                        onChange={(e) =>
                                                            handleQuantityChange(
                                                                burritoNameWithPrice,
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-16 text-center mx-2 h-8"
                                                        aria-label={`Quantity for ${
                                                            burritoNameWithPrice.split(
                                                                ' - '
                                                            )[0]
                                                        }`}
                                                        required
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            handleQuantityChange(
                                                                burritoNameWithPrice,
                                                                currentQuantity +
                                                                    1
                                                            )
                                                        }
                                                        aria-label={`Increase quantity for ${burritoNameWithPrice}`}>
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                                {formActionState?.errors?.burritoOrders &&
                                    !form.formState.errors.selectedBurritos && (
                                        <p className="text-sm text-destructive">
                                            {
                                                formActionState.errors
                                                    .burritoOrders[0]
                                            }
                                        </p>
                                    )}
                            </div>
                        )}

                        {/* Preferences Section */}
                        <FormField
                            control={form.control}
                            name="preferences"
                            render={(
                                { field } // field.value will be '' if empty
                            ) => (
                                <FormItem className="pt-4 border-t border-border">
                                    <FormLabel className="text-md font-semibold text-primary">
                                        Preferences
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Any special requests or dietary notes? (e.g., extra salsa, no onions, gluten-free tortilla if available)"
                                            className="resize-y min-h-[80px]"
                                            {...field} // field.value is passed here. If '', Textarea gets ''
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Let us know if you have any special
                                        instructions for your order.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {formActionState?.errors?._form && ( // For general server errors not tied to a specific field
                            <Alert variant="destructive" className="mt-4">
                                <AlertTitle>Server Error</AlertTitle>
                                <AlertDescription>
                                    {formActionState.errors._form[0]}
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="text-sm text-muted-foreground mt-2">
                            **To Reserve your Burritos, please venmo @marcopete5
                            the total amount.
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton
                            isPending={
                                form.formState.isSubmitting ||
                                isTransitionPending
                            }
                        />
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
