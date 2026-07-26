import type { EditorConfig, LexicalNode, NodeKey, SerializedTextNode } from "lexical";
import { TextNode } from "lexical";

export class MentionNode extends TextNode {
  __memberId: string;

  static override getType(): string {
    return "mention";
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__memberId, node.__text, node.__key);
  }

  constructor(memberId: string, text?: string, key?: NodeKey) {
    super(text ?? "@unknown", key);
    this.__memberId = memberId;
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.backgroundColor = "rgba(59, 130, 246, 0.15)";
    dom.style.borderRadius = "3px";
    dom.style.padding = "0 2px";
    return dom;
  }

  override updateDOM(_prevNode: this, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  static override importJSON(serializedNode: SerializedTextNode): MentionNode {
    const node = $createMentionNode("");
    node.setTextContent(serializedNode.text);
    return node;
  }

  override exportJSON(): SerializedTextNode {
    return {
      ...super.exportJSON(),
      type: "mention",
    };
  }
}

export function $createMentionNode(memberId: string, mentionName?: string): MentionNode {
  const node = new MentionNode(memberId, `@${mentionName ?? "unknown"}`);
  node.setMode("segmented").toggleDirectionless();
  return node;
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
