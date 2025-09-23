"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const HoverDropdownMenu = DropdownMenuPrimitive.Root

const HoverDropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger> & {
    asChild?: boolean;
  }
>(({ className, children, asChild = false, ...props }, ref) => {
  const [open, setOpen] = React.useState(false)
  
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger
        ref={ref}
        asChild={asChild}
        className={cn(className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Trigger>
    </DropdownMenuPrimitive.Root>
  )
})
HoverDropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

const HoverDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        onMouseEnter={(e) => e.preventDefault()}
        onMouseLeave={(e) => {
          // Close dropdown when mouse leaves the content
          const root = e.currentTarget.closest('[data-radix-dropdown-menu-content]')?.parentElement
          if (root) {
            const trigger = root.querySelector('[data-radix-dropdown-menu-trigger]') as HTMLElement
            if (trigger) {
              trigger.click() // Close the dropdown
            }
          }
        }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
})
HoverDropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

export {
  HoverDropdownMenu,
  HoverDropdownMenuTrigger,
  HoverDropdownMenuContent,
}