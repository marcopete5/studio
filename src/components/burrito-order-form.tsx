'use client';

import React, {
    useActionState,
    useEffect,
    useRef,
    useState,
    useTransition
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Utensils, Minus, Plus } from 'lucide-react';
import { submitBurritoOrder, type FormState } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

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
    preferences: z.string().optional()
});

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

interface QuantitySelectorProps {
    id: string;
    value: number;
    onChange: (newValue: number) => void;
    min?: number;
    max?: number;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
    id,
    value,
    onChange,
    min = 1,
    max
}) => {
    const handleDecrement = () => {
        onChange(Math.max(min, value - 1));
    };

    const handleIncrement = () => {
        if (max === undefined || value < max) {
            onChange(value + 1);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        if (rawValue === '') {
            // Allow temporary empty for typing
        }
        const numValue = parseInt(rawValue, 10);

        if (isNaN(numValue)) {
            return;
        }

        if (numValue < min) {
            onChange(min);
        } else if (max !== undefined && numValue > max) {
            onChange(max);
        } else {
            onChange(numValue);
        }
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const numValue = parseInt(e.target.value, 10);
        if (isNaN(numValue) || numValue < min) {
            onChange(min);
        } else if (max !== undefined && numValue > max) {
            onChange(max);
        } else if (!isNaN(numValue)) {
            onChange(numValue);
        }
    };

    return (
        <div className="flex items-center space-x-1.5 sm:space-x-2">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                onClick={handleDecrement}
                disabled={value <= min}
                aria-label="Decrease quantity">
                <Minus className="h-4 w-4" />
            </Button>
            <Input
                id={id}
                type="number"
                value={value.toString()}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                min={min}
                max={max}
                className="w-12 sm:w-16 text-center h-8 sm:h-9 px-1"
                required
            />
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
                onClick={handleIncrement}
                disabled={max !== undefined && value >= max}
                aria-label="Increase quantity">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
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
            selectedBurritos: [],
            preferences: ''
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

    const handleQuantityUpdate = (burritoName: string, newQuantity: number) => {
        const quantity = Math.max(1, isNaN(newQuantity) ? 1 : newQuantity);
        setQuantities((prev) => ({
            ...prev,
            [burritoName]: quantity
        }));
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
                formState.errors?.burritoOrders?.[0] || // Check for burritoOrders first as per server state
                formState.errors?.preferences?.[0] ||
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
                // ** CORRECTED ERROR MAPPING HERE **
                if (formState.errors.burritoOrders)
                    // Check for 'burritoOrders' from server
                    form.setError('selectedBurritos', {
                        // Map to client field 'selectedBurritos'
                        type: 'server',
                        message: formState.errors.burritoOrders[0]
                    });
                if (formState.errors.preferences)
                    form.setError('preferences', {
                        type: 'server',
                        message: formState.errors.preferences[0]
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

        if (data.preferences && data.preferences.trim() !== '') {
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
            const allQuantitiesZero = data.selectedBurritos.every(
                (b) => (quantities[b] || 0) === 0
            );
            if (allQuantitiesZero) {
                form.setError('selectedBurritos', {
                    type: 'manual',
                    message:
                        'Please specify a quantity greater than 0 for selected burritos.'
                });
                toast({
                    variant: 'destructive',
                    title: 'Validation Error',
                    description:
                        'Please specify a quantity greater than 0 for selected burritos.'
                });
                return;
            }
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

    // This is where line 398 was reported
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
                        {/* ** ERRONEOUS PLACEHOLDER LINES REMOVED FROM HERE ** */}
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

                        {/* Selected Burritos Field */}
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

                        {/* Preferences Field */}
                        <FormField
                            control={form.control}
                            name="preferences"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Preferences / Special Instructions
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="e.g., No onions, extra salsa, allergy information."
                                            className="resize-y min-h-[80px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Optional: Let us know if you have any
                                        special requests for your order.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                        const baseId =
                                            burritoNameWithPrice.replace(
                                                /\W/g,
                                                '-'
                                            );
                                        const quantityInputId = `quantity-input-${baseId}`;

                                        return (
                                            <div
                                                key={`quantity-item-${burritoNameWithPrice}`}
                                                className="flex flex-col items-stretch space-y-1 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:space-x-3 animate-in fade-in duration-500">
                                                <Label
                                                    htmlFor={quantityInputId}
                                                    className="flex-1 text-sm sm:text-base mb-1 sm:mb-0 min-w-0 break-words">
                                                    {burritoNameWithPrice}
                                                </Label>
                                                <QuantitySelector
                                                    id={quantityInputId}
                                                    value={quantity}
                                                    onChange={(newVal) =>
                                                        handleQuantityUpdate(
                                                            burritoNameWithPrice,
                                                            newVal
                                                        )
                                                    }
                                                    min={1}
                                                />
                                            </div>
                                        );
                                    }
                                )}
                                {formState?.errors?.burritoOrders && // Check original server error key
                                    !form.formState.errors.selectedBurritos && ( // If not already set on client field
                                        <p className="text-sm text-destructive mt-2">
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
