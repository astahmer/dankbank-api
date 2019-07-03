export const getAppRoutes = (arr: any): string[] => {
    const returnRoute = (midw: any) => {
        const formatRoute = (v: any) => v.methods.join(",") + " : " + v.path;
        return midw.router && midw.router.stack.length && midw.router.stack.map(formatRoute);
    };
    return arr.map(returnRoute).filter((path: string) => path);
};
