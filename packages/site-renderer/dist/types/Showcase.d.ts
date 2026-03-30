export interface ShowData {
    id: string;
    title: string;
    description: string;
    date?: string;
    time?: string;
    location?: string;
    ticketsUrl?: string;
    imageUrl?: string;
    image?: string;
}
export interface PartnerData {
    name: string;
    logoUrl: string;
}
export interface TeamMemberData {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    image?: string;
    socialLinks?: Record<string, string>;
}
//# sourceMappingURL=Showcase.d.ts.map