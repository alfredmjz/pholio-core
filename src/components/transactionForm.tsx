import { LuBookText } from 'react-icons/lu';
import { DialogButton } from './dialog';
import { Button } from './ui/button';

const formContent = () => {
	return (
		<form>
			<input id="entry" name="entry" type="text" step="0.01" min="0" inputMode="decimal" required />
			<div className="flex justify-between">
				<div className="text-center">
					<span>Expense</span>
				</div>
				<div className="text-center">
					<span>Income</span>
				</div>
			</div>
			<button type="submit">Submit</button>
		</form>
	);
};

const formTrigger = () => {
	return (
		<Button className="flex flex-row items-center gap-4 min-h-10 bg-constructive font-semibold text-md">
			<LuBookText className="w-4 h-4" strokeWidth={3} />
			<span>New</span>
		</Button>
	);
};

function TransactionFormComponent() {
	return <DialogButton trigger={formTrigger()} content={formContent()} buttonLabel="Log transaction" />;
}

export default TransactionFormComponent;
