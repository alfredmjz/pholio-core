'use client';

import { LuBookText } from 'react-icons/lu';
import { DialogButton } from './dialog';
import { Button } from './ui/button';
import { KeyboardEvent, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

import { cn } from '@/lib/utils';

type TransactionType = 'expense' | 'income';

const FormContent = () => {
	const [selected, setSelected] = useState<TransactionType>('expense');

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		// Add your form submission logic here
	};

	const transactionFilter = (event: KeyboardEvent<HTMLInputElement>) => {
		const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', ','];
		if (!/[0-9]/.test(event.key) && !allowedKeys.includes(event.key) && !event.ctrlKey) {
			event.preventDefault();
		}
	};

	return (
		<form
			id="transaction-form"
			onSubmit={handleSubmit}
			className="flex flex-col gap-4 justify-center items-center p-4 h-full"
		>
			<input
				name="entry"
				type="number"
				step="0.01"
				min="0"
				inputMode="decimal"
				onKeyDown={(e) => transactionFilter(e)}
				className="w-2/3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
				required
			/>
			<ToggleGroup
				type="single"
				value={selected}
				onValueChange={(value) => value && setSelected(value as TransactionType)}
				className="grid grid-cols-2 relative w-2/3 rounded-3xl bg-primary p-1"
			>
				{/* Sliding background */}
				<div
					className={cn(
						'absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-3xl bg-primary-highlight transition-transform duration-300 ease-in-out',
						selected === 'income' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-[0.25rem]'
					)}
					aria-hidden="true"
				/>

				<ToggleGroupItem
					value="expense"
					className={cn(
						'flex-1 relative z-10 rounded-3xl transition-colors',
						'data-[state=on]:text-primary-foreground',
						'hover:text-primary data-[state=on]:bg-transparent'
					)}
				>
					Expense
				</ToggleGroupItem>
				<ToggleGroupItem
					value="income"
					className={cn(
						'flex-1 relative z-10 rounded-3xl transition-colors',
						'data-[state=on]:text-primary-foreground',
						'hover:text-primary data-[state=on]:bg-transparent'
					)}
				>
					Income
				</ToggleGroupItem>
			</ToggleGroup>
		</form>
	);
};

const FormTrigger = () => (
	<Button className="flex flex-row items-center gap-4 min-h-10 bg-constructive font-semibold text-md">
		<LuBookText className="w-4 h-4" strokeWidth={3} />
		<span>New</span>
	</Button>
);

export default function TransactionFormComponent() {
	return (
		<DialogButton
			trigger={FormTrigger()}
			content={FormContent()}
			buttonLabel="Log transaction"
			formId="transaction-form"
		/>
	);
}
