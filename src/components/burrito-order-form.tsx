// src/components/burrito-order-form.tsx
'use client';

import React, {
    // useActionState, // Replaced with useFormState from react-dom if that's what you meant
    useEffect,
    // useMemo, // Not used in the provided snippet
    useTransition,
    useRef
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useWatch } from 'react-hook-form';
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
import { Label } from '@/components/ui/label'; // Label from shadcn might not be needed if using FormLabel
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
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

// If useActionState is from 'react', it's for server actions.
// If you meant useFormState from 'react-dom' for client-side state with server actions:
import { useFormState } from 'react-dom'; // Or 'react' if it's the new React Canary useActionState

// Schema for client-side validation - ADDED PREFERENCES
const formSchema = z.object({
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
    selectedBurritos: z
        .array(z.string())
        .min(1, 'Please select at least one burrito.'),
    preferences: z.string().optional() // <-- ADDED PREFERENCES FIELD
});

// Burrito options with prices
const burritoOptions = [
    'Bean & Cheese Burrito - $5',
    'Beef & Bean Burrito - $6',
    'Burrito of the Week* - $10'
];

// SubmitButton component now accepts isPending prop
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

// Helper function to normalize/format US phone numbers
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
    }; // Added errors to initial state

    // Using useFormState from react-dom for server actions.
    // If submitBurritoOrder is a pure client-side function that doesn't fit useFormState,
    // you might need a different state management approach for its result.
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
            email: '',
            phoneNumber: '',
            selectedBurritos: [],
            preferences: '' // <-- DEFAULT VALUE FOR PREFERENCES
        },
        mode: 'onChange'
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
                        prevQuantities[burritoName] || 1;
                });
                return newQuantities;
            });
        }
        prevWatchedSelectedBurritosRef.current = currentSelected;
    }, [watchedSelectedBurritos]);

    const handleQuantityChange = (burritoName: string, value: string) => {
        const numValue = parseInt(value, 10);
        const newQuantity = isNaN(numValue) || numValue < 1 ? 1 : numValue;
        setQuantities((prev) => ({ ...prev, [burritoName]: newQuantity }));
    };

    useEffect(() => {
        if (formActionState?.success) {
            toast({
                title: 'Success!',
                description: formActionState.message
            });
            form.reset(); // Reset react-hook-form fields
            setQuantities({}); // Reset local quantity state
        } else if (
            formActionState?.message &&
            !formActionState.success &&
            formActionState.message !== '' // Ensure there's a message to show
        ) {
            const errorMessage =
                formActionState.errors?._form?.[0] ||
                formActionState.errors?.burritoOrders?.[0] || // This might need adjustment if burritoOrders error is specific
                formActionState.message;
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: errorMessage
            });

            // Set errors from server action to react-hook-form
            if (formActionState.errors) {
                if (formActionState.errors.name)
                    form.setError('name', {
                        type: 'server',
                        message: formActionState.errors.name[0]
                    });
                if (formActionState.errors.email)
                    form.setError('email', {
                        type: 'server',
                        message: formActionState.errors.email[0]
                    });
                if (formActionState.errors.phoneNumber)
                    form.setError('phoneNumber', {
                        type: 'server',
                        message: formActionState.errors.phoneNumber[0]
                    });
                if (formActionState.errors.selectedBurritos)
                    form.setError('selectedBurritos', {
                        type: 'server',
                        message: formActionState.errors.selectedBurritos[0]
                    });
                if (formActionState.errors.preferences)
                    form.setError('preferences', {
                        type: 'server',
                        message: formActionState.errors.preferences[0]
                    }); // <-- SET PREFERENCES ERROR
            }
        }
    }, [formActionState, toast, form]);

    const anySelected = watchedSelectedBurritos.length > 0;

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        const formDataForServer = new FormData();
        formDataForServer.append('name', data.name);
        if (data.email) {
            formDataForServer.append('email', data.email);
        }
        formDataForServer.append('phoneNumber', data.phoneNumber);
        if (data.preferences) {
            // <-- ADD PREFERENCES TO FORMDATA
            formDataForServer.append('preferences', data.preferences);
        }

        let hasAtLeastOneQuantity = false;
        data.selectedBurritos.forEach((burritoNameWithPrice) => {
            const quantity = quantities[burritoNameWithPrice] || 0;
            if (quantity > 0) {
                const burritoNameOnly = burritoNameWithPrice.split(' - ')[0];
                formDataForServer.append(
                    `quantity-${burritoNameOnly}`,
                    String(quantity)
                );
                hasAtLeastOneQuantity = true;
            }
        });

        if (!hasAtLeastOneQuantity && data.selectedBurritos.length > 0) {
            form.setError('selectedBurritos', {
                type: 'manual',
                message: 'Please specify a quantity for selected burritos.'
            });
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please specify a quantity for selected burritos.'
            });
            return;
        }

        startTransition(() => {
            formAction(formDataForServer);
        });
    };

    const onInvalid = (errors: any) => {
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
                    Pre-orders end Thursday May 15 @ 7am.
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
                    onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                    className="space-y-0">
                    <CardContent className="space-y-6">
                        {/* Name, Email, Phone Number Fields ... (Keep as is) */}
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
                                            {...field}
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

                        {/* Selected Burritos Field ... (Keep as is) */}
                        <FormField
                            control={form.control}
                            name="selectedBurritos"
                            render={({
                                field: { onChange, value, ...restField }
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
                                                        value?.includes(
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
                                                                        value ||
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
                                                                    );
                                                                }}
                                                                aria-labelledby={`label-${burritoOption.replace(
                                                                    /\W/g,
                                                                    '-'
                                                                )}`}
                                                                {...restField}
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

                        {/* Quantity Section ... (Keep as is, or integrate preferences before/after) */}
                        {anySelected && (
                            <div className="space-y-4 pt-4 border-t border-border transition-all duration-300 ease-in-out">
                                <h3 className="text-md font-semibold text-primary">
                                    Quantity
                                </h3>
                                {watchedSelectedBurritos.map(
                                    (burritoNameWithPrice) => {
                                        const quantity =
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
                                                <Input
                                                    id={`quantity-input-${burritoNameWithPrice.replace(
                                                        /\W/g,
                                                        '-'
                                                    )}`}
                                                    type="number"
                                                    min="1"
                                                    value={quantity}
                                                    onChange={(e) =>
                                                        handleQuantityChange(
                                                            burritoNameWithPrice,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="w-20"
                                                    aria-label={`Quantity for ${
                                                        burritoNameWithPrice.split(
                                                            ' - '
                                                        )[0]
                                                    }`}
                                                    required
                                                />
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

                        {/* --- Preferences Section (NEW) --- */}
                        <FormField
                            control={form.control}
                            name="preferences"
                            render={({ field }) => (
                                <FormItem className="pt-4 border-t border-border">
                                    {' '}
                                    {/* Added some top padding and border for separation */}
                                    <FormLabel className="text-md font-semibold text-primary">
                                        Preferences
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Any special requests or dietary notes? (e.g., no rice, no onions, etc..)"
                                            className="resize-y min-h-[80px]" // Allow vertical resize, set min height
                                            {...field}
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
                        {/* --- End Preferences Section --- */}

                        {formActionState?.errors?._form && (
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
