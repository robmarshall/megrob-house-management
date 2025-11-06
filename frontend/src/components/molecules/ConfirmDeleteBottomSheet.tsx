import { useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import BottomSheet from '@/components/atoms/BottomSheet';
import { Button } from '@/components/atoms/Button';

interface ConfirmDeleteBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemName: string;
  itemType?: string;
  isDeleting?: boolean;
  warningMessage?: string;
}

export function ConfirmDeleteBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  isDeleting = false,
  warningMessage,
}: ConfirmDeleteBottomSheetProps) {
  const [confirmationStep, setConfirmationStep] = useState<1 | 2>(1);

  const handleClose = () => {
    if (isDeleting) return; // Prevent closing during deletion
    setConfirmationStep(1);
    onClose();
  };

  const handleFirstConfirm = () => {
    setConfirmationStep(2);
  };

  const handleFinalConfirm = async () => {
    try {
      await onConfirm();
      setConfirmationStep(1);
      onClose();
    } catch (error) {
      // Error handling is done by parent component
      console.error('Deletion failed:', error);
    }
  };

  const handleCancel = () => {
    setConfirmationStep(1);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={confirmationStep === 1 ? 'Delete Confirmation' : 'Final Confirmation'}
    >
      <div className="flex flex-col gap-6">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div
            className={`rounded-full p-3 ${
              confirmationStep === 1 ? 'bg-yellow-100' : 'bg-red-100'
            }`}
          >
            <ExclamationTriangleIcon
              className={`h-8 w-8 ${
                confirmationStep === 1 ? 'text-yellow-600' : 'text-red-600'
              }`}
            />
          </div>
        </div>

        {/* Step 1: Initial Warning */}
        {confirmationStep === 1 && (
          <div className="flex flex-col gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Delete "{itemName}"?
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {warningMessage ||
                  `Are you sure you want to delete this ${itemType}? This action cannot be undone.`}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="secondary"
                onClick={handleClose}
                className="w-full"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleFirstConfirm}
                className="w-full"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Final Confirmation */}
        {confirmationStep === 2 && (
          <div className="flex flex-col gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Are you absolutely sure?
              </p>
              <p className="mt-2 text-sm text-gray-600">
                This will permanently delete "{itemName}" and all associated
                data. This action is irreversible.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isDeleting}
                className="w-full"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleFinalConfirm}
                isLoading={isDeleting}
                className="w-full"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
