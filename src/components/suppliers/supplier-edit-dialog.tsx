"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Supplier } from "@/db/schema";

import { SupplierForm } from "./supplier-form";

export function SupplierEditDialog({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Modifier
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Modifier ${supplier.name}`}
        className="max-w-2xl"
      >
        {open ? <SupplierForm supplier={supplier} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
