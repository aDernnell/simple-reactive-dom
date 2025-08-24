
export const dispatchEventOnAllElements = (event: Event, element: Element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let current: Node | null = walker.currentNode;
    while (current) {
        const el = current as Element;
        el.dispatchEvent(event);
        current = walker.nextNode();
    }
};
