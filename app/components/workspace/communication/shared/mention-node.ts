import type { EditorConfig, LexicalNode, NodeKey, SerializedTextNode } from "lexical";
import { TextNode } from "lexical";

export type MentionType = "user" | "channel";

export class MentionNode extends TextNode {
  __mentionName: string;
  __targetId: string;
  __type: MentionType;

  static override getType(): string {
    return "mention";
  }

  static override clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__type,
      node.__mentionName,
      node.__targetId,
      node.__text,
      node.__key,
    );
  }

  constructor(
    type: MentionType,
    mentionName: string,
    targetId: string,
    text?: string,
    key?: NodeKey,
  ) {
    super(text ?? `@${mentionName}`, key);
    this.__type = type;
    this.__mentionName = mentionName;
    this.__targetId = targetId;
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = "mention-pill text-brand cursor-pointer";
    dom.dataset.targetId = this.__targetId;
    dom.dataset.targetType = this.__type;
    return dom;
  }

  override updateDOM(_prevNode: this, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  static override importJSON(
    serializedNode: SerializedTextNode & {
      mentionName: string;
      targetId: string;
      type: MentionType;
    },
  ): MentionNode {
    return $createMentionNode(
      serializedNode.type,
      serializedNode.mentionName,
      serializedNode.targetId,
    );
  }

  override exportJSON() {
    return {
      ...super.exportJSON(),
      mentionName: this.__mentionName,
      targetId: this.__targetId,
      targetType: this.__type,
      type: "mention",
      version: 1,
    };
  }

  isTextEntity(): true {
    return true;
  }
}

export function $createMentionNode(
  type: MentionType,
  mentionName: string,
  targetId: string,
): MentionNode {
  const node = new MentionNode(type, mentionName, targetId);
  node.setMode("segmented");
  return node;
}

export function $isMentionNode(node?: LexicalNode | null): node is MentionNode {
  return node instanceof MentionNode;
}
