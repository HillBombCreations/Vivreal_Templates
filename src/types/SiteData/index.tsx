export interface SiteData {
    primary?: string;
    secondary?: string;
    hover?: string;
    surface?: string;
    pages: Record<string, string>;
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    border?: string;
    logo: {
        name?: string,
        key: string,
        type: string,
        currentFile: {
            source: string
        }
    },
}