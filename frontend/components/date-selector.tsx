"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { formatDisplayDate } from "@/lib/dateUtils"
import { cn } from "@/lib/utils"

interface DateSelectorProps {
  selectedDate: string
  onDateChange: (date: string) => void
  disabled?: boolean
}

export function DateSelector({ selectedDate, onDateChange, disabled }: DateSelectorProps) {
  const [open, setOpen] = useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date.toISOString().split("T")[0])
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("flex items-center gap-2 bg-transparent", !selectedDate && "text-muted-foreground")}
          disabled={disabled}
        >
          <CalendarIcon className="h-4 w-4" />
          {selectedDate ? formatDisplayDate(selectedDate) : "Select date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate ? new Date(selectedDate) : undefined}
          onSelect={handleDateSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
