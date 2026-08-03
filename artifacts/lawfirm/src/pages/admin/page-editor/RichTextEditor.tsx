import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import { useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Link2, ImageIcon, Undo2, Redo2, Code,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-[#0f2044] text-white"
          : "text-gray-600 hover:bg-gray-100 disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Start typing…" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] px-4 py-3 focus:outline-none text-gray-800",
      },
    },
  });

  // Sync external value (e.g., when AI result is applied or version restored)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const applyLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().setLink({ href: linkUrl }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
    setShowImageInput(false);
  }, [editor, imageUrl]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-100 bg-gray-50">
        {/* History */}
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 size={14} />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 size={14} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Headings */}
        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={14} />
        </ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={14} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Inline marks */}
        <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={14} />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={14} />
        </ToolBtn>
        <ToolBtn title="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={14} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Lists */}
        <ToolBtn title="Bullet List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </ToolBtn>
        <ToolBtn title="Ordered List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </ToolBtn>
        <ToolBtn title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </ToolBtn>
        <ToolBtn title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={14} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Alignment */}
        <ToolBtn title="Align Left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={14} />
        </ToolBtn>
        <ToolBtn title="Align Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={14} />
        </ToolBtn>
        <ToolBtn title="Align Right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={14} />
        </ToolBtn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Link */}
        <ToolBtn title="Link" active={editor.isActive("link")} onClick={() => setShowLinkInput(v => !v)}>
          <Link2 size={14} />
        </ToolBtn>
        {/* Image */}
        <ToolBtn title="Insert Image" onClick={() => setShowImageInput(v => !v)}>
          <ImageIcon size={14} />
        </ToolBtn>
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyLink()}
            placeholder="https://example.com"
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none"
          />
          <button type="button" onClick={applyLink} className="text-xs bg-[#0f2044] text-white px-3 py-1 rounded">Apply</button>
          <button type="button" onClick={() => setShowLinkInput(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Image input */}
      {showImageInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
          <input
            autoFocus
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && insertImage()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none"
          />
          <button type="button" onClick={insertImage} className="text-xs bg-[#0f2044] text-white px-3 py-1 rounded">Insert</button>
          <button type="button" onClick={() => setShowImageInput(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Editor body */}
      <EditorContent editor={editor} />
    </div>
  );
}
