import { ObjectType } from "typeorm";
import { makeEntityRouter } from "./makeEntityRouter";

const getMetaDataProps = (props: string[], entity: ObjectType<any>) => {
    const metadata: any = {};
    for (let i = 0; i < props.length; i++) {
        metadata[props[i]] = Reflect.getMetadata(props[i], entity);
    }
    return metadata;
};

export function useEntitiesRoutes(app: any, entities: ObjectType<any>[]) {
    let router;
    for (let i = 0; i < entities.length; i++) {
        router = makeEntityRouter(getMetaDataProps(["entity", "route", "groups"], entities[i]));
        app.use(router.routes());
    }
}
