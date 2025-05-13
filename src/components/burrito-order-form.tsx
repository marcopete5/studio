'use client';

import React, {
    useActionState,
    useEffect,
    useMemo,
    useTransition,
    useRef
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { z } from 'zod';

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
import { submitBurritoOrder, type FormState } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

// Schema for client-side validation
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
        .min(1, 'Please select at least one burrito.')
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

    // Remove all non-numeric characters except '+'
    let digits = value.replace(/[^\d+]/g, '');

    // If it starts with '+', ensure it's '+1' or just '+' if that's all they typed
    if (digits.startsWith('+')) {
        if (digits.length > 1 && !digits.startsWith('+1')) {
            digits = '+1' + digits.substring(1);
        }
    } else if (digits.length > 0) {
        // Doesn't start with +
        if (digits.startsWith('1') && digits.length > 1) {
            // Starts with 1 (likely US country code)
            digits = '+' + digits;
        } else {
            // Assumed to be a local number, prepend +1
            digits = '+1' + digits;
        }
    }

    // Keep only +1 and up to 10 subsequent digits
    const match = digits.match(/^(\+1\d{0,10}).*$/);
    if (match) {
        return match[1];
    }

    // Handle cases like only "+" or partial "+1"
    if (digits === '+') return '+';
    if (digits === '+1' && value.length <= 2) return '+1';

    return value; // Return original value if complex or non-conforming for further typing
};

export default function BurritoOrderForm() {
    const initialFormState: FormState = { message: '', success: false };

    const [formState, formAction] = useActionState<FormState, FormData>(
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
            selectedBurritos: []
        },
        mode: 'onChange' // Validate on change for immediate feedback
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
        if (formState?.success) {
            toast({
                title: 'Success!',
                description: formState.message
            });
            form.reset();
            setQuantities({});
        } else if (
            formState?.message &&
            !formState.success &&
            formState.message !== ''
        ) {
            const errorMessage =
                formState.errors?._form?.[0] ||
                formState.errors?.burritoOrders?.[0] ||
                formState.message;
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: errorMessage
            });

            if (formState.errors) {
                if (formState.errors.name)
                    form.setError('name', {
                        type: 'server',
                        message: formState.errors.name[0]
                    });
                if (formState.errors.email)
                    form.setError('email', {
                        type: 'server',
                        message: formState.errors.email[0]
                    });
                if (formState.errors.phoneNumber)
                    form.setError('phoneNumber', {
                        type: 'server',
                        message: formState.errors.phoneNumber[0]
                    });
                if (formState.errors.burritoOrders)
                    form.setError('selectedBurritos', {
                        type: 'server',
                        message: formState.errors.burritoOrders[0]
                    });
            }
        }
    }, [formState, toast, form]);

    const anySelected = watchedSelectedBurritos.length > 0;

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        const formDataForServer = new FormData();
        formDataForServer.append('name', data.name);
        if (data.email) {
            formDataForServer.append('email', data.email);
        }
        formDataForServer.append('phoneNumber', data.phoneNumber);

        let hasAtLeastOneQuantity = false;
        data.selectedBurritos.forEach((burritoNameWithPrice) => {
            const quantity = quantities[burritoNameWithPrice] || 0;
            if (quantity > 0) {
                // Extract just the name for the server action key
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
                                            onChange={(e) => {
                                                const formattedValue =
                                                    normalizePhoneNumber(
                                                        e.target.value
                                                    );
                                                field.onChange(formattedValue);
                                            }}
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

                        <FormField
                            control={form.control}
                            name="selectedBurritos"
                            render={(
                                { field: { onChange, value, ...restField } } // Destructure `value` here
                            ) => (
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
                                                        ); // Use `value` from render prop

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
                                                                        []; // Use `value`
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
                                                                    ); // Call onChange from render prop
                                                                    form.trigger(
                                                                        'selectedBurritos'
                                                                    ); // Manually trigger validation
                                                                }}
                                                                aria-labelledby={`label-${burritoOption.replace(
                                                                    /\W/g,
                                                                    '-'
                                                                )}`}
                                                                {...restField} // Pass down other field props
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
                                {formState?.errors?.burritoOrders &&
                                    !form.formState.errors.selectedBurritos && (
                                        <p className="text-sm text-destructive">
                                            {formState.errors.burritoOrders[0]}
                                        </p>
                                    )}
                            </div>
                        )}

                        {formState?.errors?._form && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertTitle>Server Error</AlertTitle>
                                <AlertDescription>
                                    {formState.errors._form[0]}
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
