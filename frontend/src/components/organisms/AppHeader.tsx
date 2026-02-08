import { useState } from "react";
import { Link } from "react-router";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Bars3Icon, HomeIcon, ArrowRightOnRectangleIcon, XMarkIcon, BookOpenIcon, ShoppingCartIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { toast } from "@/lib/toast";

export function AppHeader() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsDrawerOpen(false);
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const handleNavigation = () => {
    setIsDrawerOpen(false);
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-1"></div>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Drawer */}
      <Transition show={isDrawerOpen} as={Fragment}>
        <Dialog onClose={() => setIsDrawerOpen(false)} className="relative z-50">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          {/* Drawer panel */}
          <Transition.Child
            as={Fragment}
            enter="transform transition ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel className="fixed right-0 top-0 h-full w-80 max-w-full bg-white shadow-xl">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Menu
                  </Dialog.Title>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close menu"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Navigation items */}
                <nav className="flex-1 px-4 py-6">
                  <div className="space-y-1">
                    <Link
                      to="/"
                      onClick={handleNavigation}
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <HomeIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Home</span>
                    </Link>

                    <Link
                      to="/shopping-lists"
                      onClick={handleNavigation}
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <ShoppingCartIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Shopping Lists</span>
                    </Link>

                    <Link
                      to="/recipes"
                      onClick={handleNavigation}
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <BookOpenIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Recipes</span>
                    </Link>

                    <Link
                      to="/household"
                      onClick={handleNavigation}
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <UserGroupIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Household</span>
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  </div>
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </header>
  );
}
