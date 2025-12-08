export const load = async ({ url }: { url: URL }) => {
    const baseUrl = url.origin;
    const currentPath = url.pathname;
    
    // Default SEO metadata
    const seo = {
        title: 'Kimpay - Simple Expense Sharing for Groups',
        description: 'Split expenses easily with friends and family. Create a group in seconds, track shared costs, and settle debts with smart balance calculations. Free, fast, and delightful to use.',
        keywords: 'expense sharing, split bills, group expenses, travel expenses, shared costs, tricount alternative, splitwise, expense tracker, debt calculator',
        canonical: `${baseUrl}${currentPath}`,
        ogImage: `${baseUrl}/og-image.png`,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        locale: 'en_US',
        alternateLocales: ['fr_FR']
    };

    return {
        seo
    };
};
