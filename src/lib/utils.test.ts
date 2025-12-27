import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
    it('merges class names correctly', () => {
        const result = cn('class1', 'class2');
        expect(result).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
        const result = cn('base', true && 'included', false && 'excluded');
        expect(result).toBe('base included');
    });

    it('handles undefined and null values', () => {
        const result = cn('base', undefined, null, 'valid');
        expect(result).toBe('base valid');
    });

    it('merges Tailwind classes correctly', () => {
        const result = cn('px-2 py-1', 'px-4');
        expect(result).toBe('py-1 px-4');
    });

    it('handles object syntax', () => {
        const result = cn('base', { active: true, disabled: false });
        expect(result).toBe('base active');
    });

    it('handles array syntax', () => {
        const result = cn(['class1', 'class2']);
        expect(result).toBe('class1 class2');
    });

    it('handles empty inputs', () => {
        const result = cn();
        expect(result).toBe('');
    });

    it('handles complex Tailwind merges', () => {
        const result = cn(
            'text-red-500 bg-blue-500',
            'text-green-500',
            'hover:text-yellow-500'
        );
        expect(result).toBe('bg-blue-500 text-green-500 hover:text-yellow-500');
    });

    it('handles responsive classes correctly', () => {
        const result = cn('p-2', 'md:p-4', 'lg:p-6');
        expect(result).toBe('p-2 md:p-4 lg:p-6');
    });
});
