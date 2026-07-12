import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmTransitionDialog({
  open,
  onOpenChange,
  transition,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transition: { title: string; from: string; to: string } | null;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar mudança de estado</AlertDialogTitle>
          <AlertDialogDescription>
            {transition ? (
              <>
                Decisão: {transition.title}. Estado atual: {transition.from}. Novo estado:{" "}
                {transition.to}. A ação será persistida e registrada.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SupersedeDecisionDialog({
  decision,
  onOpenChange,
  onConfirm,
}: {
  decision: { title: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { title: string; decision: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    setTitle(decision?.title ?? "");
    setText("");
  }, [decision]);

  return (
    <AlertDialog open={Boolean(decision)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Substituir decisão</AlertDialogTitle>
          <AlertDialogDescription>
            A decisão atual será marcada como substituída e a nova decisão será aceita em uma RPC
            transacional.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Texto da nova decisão"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            disabled={!title.trim() || !text.trim()}
            onClick={() => onConfirm({ title, decision: text })}
          >
            Substituir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TextInputDialog({
  open,
  title,
  description,
  placeholder,
  multiline = false,
  confirmLabel = "Confirmar",
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  multiline?: boolean;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const Field = multiline ? Textarea : Input;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
