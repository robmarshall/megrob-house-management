import { useState, type FormEvent } from 'react'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'

interface AddItemInputProps {
  onAdd: (name: string, category?: string) => Promise<void> | void
  placeholder?: string
  categories?: string[]
}

export function AddItemInput({
  onAdd,
  placeholder = 'Add item...',
  categories = [
    'Produce',
    'Dairy',
    'Meat',
    'Bakery',
    'Pantry',
    'Frozen',
    'Beverages',
    'Household',
    'Other',
  ],
}: AddItemInputProps) {
  const [itemName, setItemName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!itemName.trim()) return

    setIsSubmitting(true)
    try {
      await onAdd(itemName.trim(), selectedCategory || undefined)
      setItemName('')
      setSelectedCategory('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-start">
      <div className="flex-1">
        <Input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="w-full"
        />
      </div>

      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        disabled={isSubmitting}
        className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Category</option>
        {categories.map((cat) => (
          <option key={cat} value={cat.toLowerCase()}>
            {cat}
          </option>
        ))}
      </select>

      <Button type="submit" disabled={!itemName.trim() || isSubmitting} isLoading={isSubmitting}>
        Add
      </Button>
    </form>
  )
}
