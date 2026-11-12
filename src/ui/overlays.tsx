/**
 * Accessible overlays built on Radix primitives (focus trapping, keyboard
 * navigation and ARIA wiring handled by the library).
 */
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide = false
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surf p-5 shadow-2xl ${
            wide ? 'max-w-3xl' : 'max-w-lg'
          }`}
        >
          <Dialog.Title className="mb-3 text-base font-semibold text-ink">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface TabDef {
  value: string;
  label: string;
}

export function TabsShell({
  tabs,
  value,
  onValueChange,
  children
}: {
  tabs: TabDef[];
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="mb-3 flex flex-wrap gap-1 rounded-lg bg-surf2 p-1">
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink2 transition-colors hover:text-ink data-[state=active]:bg-surf data-[state=active]:text-ink"
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export function Toggle({
  checked,
  onCheckedChange,
  label,
  id
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-ok"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]" />
      </Switch.Root>
    </div>
  );
}

export function Tip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg border border-line bg-surf2 px-3 py-1.5 text-xs text-ink shadow-lg"
          >
            {content}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
