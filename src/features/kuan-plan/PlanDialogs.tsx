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
