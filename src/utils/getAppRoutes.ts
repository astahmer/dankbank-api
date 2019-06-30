export const getAppRoutes = (arr: any): string[] => {
    const returnPath = (midw: any) => {
        return midw.router && midw.router.stack.length && midw.router.stack.map((v: any) => v.path);
    };
    return arr.map(returnPath).filter((path: string) => path);
};
