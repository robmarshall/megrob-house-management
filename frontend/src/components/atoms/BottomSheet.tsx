import {
  Dialog,
  Transition,
  DialogPanel,
  TransitionChild,
  DialogTitle,
} from "@headlessui/react";
import { Fragment, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { IconButton } from "./IconButton";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
}: BottomSheetProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </TransitionChild>

        {/* Bottom Sheet Panel */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="translate-y-full"
          enterTo="translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="translate-y-0"
          leaveTo="translate-y-full"
        >
          <div className="fixed inset-x-0 bottom-0 flex items-end justify-center">
            <DialogPanel className="w-full max-w-2xl bg-white rounded-t-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                {title && (
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    {title}
                  </DialogTitle>
                )}
                {!title && <div />}
                <IconButton
                  variant="ghost"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </IconButton>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-4">{children}</div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
