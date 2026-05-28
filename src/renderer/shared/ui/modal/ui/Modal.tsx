import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalRootProps = {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
};

function Root({ children, open, onClose }: ModalRootProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>{children}</Dialog.Portal>
    </Dialog.Root>
  );
}

function Overlay() {
  return <Dialog.Overlay className="modal-overlay" />;
}

type ContentProps = {
  children: ReactNode;
};

function Content({ children }: ContentProps) {
  return <Dialog.Content className="modal-content">{children}</Dialog.Content>;
}

type HeaderProps = {
  children: ReactNode;
};

function Header({ children }: HeaderProps) {
  return <div className="modal-head">{children}</div>;
}

type TitleProps = {
  children: ReactNode;
};

function Title({ children }: TitleProps) {
  return <Dialog.Title className="modal-title">{children}</Dialog.Title>;
}

type DescriptionProps = {
  children: ReactNode;
};

function Description({ children }: DescriptionProps) {
  return (
    <Dialog.Description className="sr-only">{children}</Dialog.Description>
  );
}

function Close() {
  return (
    <Dialog.Close asChild>
      <button className="icon-button" type="button" aria-label="Close">
        <X />
      </button>
    </Dialog.Close>
  );
}

export const Modal = Object.assign(Root, {
  Close,
  Content,
  Description,
  Header,
  Overlay,
  Title,
});
