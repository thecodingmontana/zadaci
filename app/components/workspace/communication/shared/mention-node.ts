import type { EditorConfig, LexicalNode, NodeKey, SerializedTextNode } from "lexical";
import { TextNode } from "lexical";

export class MentionNode extends TextNode {
  __mentionName: string;
  __userId: string;

  static override getType(): string {
    return "mention";
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionName, node.__userId, node.__text, node.__key);
  }

  constructor(mentionName: string, userId: string, text?: string, key?: NodeKey) {
    super(text ?? `@${mentionName}`, key);
    this.__mentionName = mentionName;
    this.__userId = userId;
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = "mention-pill";
    dom.dataset.userId = this.__userId;
    return dom;
  }

  override updateDOM(_prevNode: this, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  static override importJSON(
    serializedNode: SerializedTextNode & { mentionName: string; userId: string },
  ): MentionNode {
    return $createMentionNode(serializedNode.mentionName, serializedNode.userId);
  }

  override exportJSON() {
    return {
      ...super.exportJSON(),
      mentionName: this.__mentionName,
      userId: this.__userId,
      type: "mention",
      version: 1,
    };
  }

  isTextEntity(): true {
    return true;
  }
}

export function $createMentionNode(mentionName: string, userId: string): MentionNode {
  const node = new MentionNode(mentionName, userId);
  node.setMode("segmented");
  return node;
}

export function $isMentionNode(node?: LexicalNode | null): node is MentionNode {
  return node instanceof MentionNode;
}
