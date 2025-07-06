export const isElement = (value: any): value is Element => {
    return value !== undefined && (value as Element)?.nodeType == Node.ELEMENT_NODE;
};

export const isText = (value: any): value is Text => {
    return value != undefined && (value as Text)?.nodeType == Node.TEXT_NODE;
};

export const isAttr = (value: any): value is Attr => {
    return value != undefined && (value as Attr)?.nodeType == Node.ATTRIBUTE_NODE;
}

export const rawHtmlToNode = (html: string): Node => {
    const template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;

    return template.content.firstChild as Node;
};