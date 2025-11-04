import { useState, Fragment } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, Transition } from "@headlessui/react";
import { ShoppingListCard } from "@/components/organisms/ShoppingListCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";
import {
  useShoppingLists,
  useShoppingListData,
} from "@/hooks/shoppingList/useShoppingLists";
import {
  createShoppingListSchema,
  type CreateShoppingListFormData,
} from "@/lib/schemas";

export function ShoppingListsPage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: lists, isLoading, error } = useShoppingLists();
  const { create, delete: deleteList } = useShoppingListData();

  const methods = useForm<CreateShoppingListFormData>({
    resolver: zodResolver(createShoppingListSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleCreateList = async (data: CreateShoppingListFormData) => {
    try {
      await create(data);
      methods.reset();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create list:", error);
    }
  };

  const handleCloseModal = () => {
    methods.reset();
    setIsCreateModalOpen(false);
  };

  const handleDeleteList = async (listId: number) => {
    await deleteList(listId);
  };

  const handleOpenList = (listId: number) => {
    navigate(`/shopping-lists/${listId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-600">Loading lists...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to load shopping lists
          </h3>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shopping Lists</h1>
            <p className="mt-1 text-sm text-gray-500">
              Organize your shopping with multiple lists
            </p>
          </div>

          <Button onClick={() => setIsCreateModalOpen(true)} variant="primary">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New List
          </Button>
        </div>

        {lists.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-16 h-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
            title="No shopping lists yet"
            description="Create your first shopping list to get started organizing your shopping"
            action={{
              label: "Create Your First List",
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {lists.map((list) => (
              <ShoppingListCard
                key={list.id}
                list={list}
                onClick={() => handleOpenList(list.id)}
                onDelete={handleDeleteList}
              />
            ))}
          </motion.div>
        )}
      </div>

      <Transition appear show={isCreateModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                    Create New Shopping List
                  </Dialog.Title>

                  <FormProvider {...methods}>
                    <form
                      onSubmit={methods.handleSubmit(handleCreateList)}
                      className="space-y-4"
                    >
                      <Input
                        name="name"
                        label="List Name"
                        placeholder="e.g., Weekly Groceries"
                        required
                      />

                      <Textarea
                        name="description"
                        label="Description"
                        placeholder="Add notes about this list..."
                        rows={3}
                      />

                      <div className="flex gap-3 justify-end pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCloseModal}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          isLoading={methods.formState.isSubmitting}
                        >
                          Create List
                        </Button>
                      </div>
                    </form>
                  </FormProvider>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
