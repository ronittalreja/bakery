"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onApply: () => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    onApply();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {startDate && endDate ? (
            `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`
          ) : (
            "Select Date Range"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Date Range</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Start Date</label>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartDateChange}
              initialFocus
              className="rounded-md border"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">End Date</label>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              className="rounded-md border"
              disabled={(date) => startDate ? date < startDate : false}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!startDate || !endDate}>
              Apply Range
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
