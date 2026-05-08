import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LocationPicker, LocationValue } from '@/components/ui/location-picker';
import { Calendar as CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CustomFieldDefinition } from '@/hooks/usePolicies';

interface CustomFieldRendererProps {
    field: CustomFieldDefinition;
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    className?: string;
}

export function CustomFieldRenderer({
    field,
    value,
    onChange,
    disabled = false,
    className,
}: CustomFieldRendererProps) {
    const renderField = () => {
        switch (field.type) {
            case 'text':
                return (
                    <Input
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        maxLength={field.validation?.max_length}
                        minLength={field.validation?.min_length}
                    />
                );

            case 'number':
            case 'currency':
                return (
                    <Input
                        type="number"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        min={field.validation?.min}
                        max={field.validation?.max}
                        step={field.type === 'currency' ? '0.01' : '1'}
                    />
                );

            case 'date':
                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !value && 'text-muted-foreground'
                                )}
                                disabled={disabled}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {value ? format(new Date(value), 'PPP') : field.placeholder || 'Select date'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={value ? new Date(value) : undefined}
                                onSelect={(date) => onChange(date?.toISOString())}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                );

            case 'select':
                return (
                    <Select
                        value={value || ''}
                        onValueChange={onChange}
                        disabled={disabled}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={field.placeholder || 'Select option'} />
                        </SelectTrigger>
                        <SelectContent>
                            {field.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`field-${field.name}`}
                            checked={value === true}
                            onCheckedChange={(checked) => onChange(checked === true)}
                            disabled={disabled}
                        />
                        <label
                            htmlFor={`field-${field.name}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {field.placeholder || 'Yes'}
                        </label>
                    </div>
                );

            case 'file':
                return (
                    <div>
                        <Input
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    onChange(file);
                                }
                            }}
                            disabled={disabled}
                            className="cursor-pointer"
                        />
                        {value && typeof value === 'object' && value.name && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Selected: {value.name}
                            </p>
                        )}
                    </div>
                );

            case 'location':
                return (
                    <LocationPicker
                        value={value as LocationValue | null}
                        onChange={onChange}
                        placeholder={field.placeholder || 'Select location on map'}
                        disabled={disabled}
                        required={field.required}
                    />
                );

            default:
                return (
                    <Input
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                    />
                );
        }
    };

    return (
        <div className={cn('space-y-2', className)}>
            <Label htmlFor={`field-${field.name}`}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {renderField()}
        </div>
    );
}

interface CustomFieldsFormProps {
    fields: CustomFieldDefinition[];
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
    disabled?: boolean;
    className?: string;
}

export function CustomFieldsForm({
    fields,
    values,
    onChange,
    disabled = false,
    className,
}: CustomFieldsFormProps) {
    if (!fields || fields.length === 0) {
        return null;
    }

    const handleFieldChange = (fieldName: string, value: any) => {
        onChange({
            ...values,
            [fieldName]: value,
        });
    };

    return (
        <div className={cn('space-y-4', className)}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Additional Information
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                    <CustomFieldRenderer
                        key={field.name}
                        field={field}
                        value={values[field.name]}
                        onChange={(value) => handleFieldChange(field.name, value)}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}
