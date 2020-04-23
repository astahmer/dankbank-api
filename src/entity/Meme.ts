import { Context } from "koa";
import { Column, Entity, getConnection, ManyToMany, ManyToOne, OneToMany, OneToOne, JoinColumn, Unique } from "typeorm";
import { ArrayMaxSize, ArrayNotEmpty, IsNotEmpty } from "class-validator";

import { ListAction } from "@/actions/Meme/ListAction";
import { SearchAction } from "@/actions/Meme/SearchAction";
import { isTokenValid } from "@/services/JWT";
import { logger } from "@/services/logger";

import { AbstractEntity } from "./AbstractEntity";
import { Comment } from "./Comment";
import { Image } from "./Image";
import { MemeBank } from "./MemeBank";
import { Tag } from "./Tag";
import { User } from "./User";
import { Visibility } from "./Visibility";
import { IsCurrentUser } from "@/validators/IsCurrentUser";
import { IsUnique } from "@/validators/IsUnique";
import { Pagination, Search, EntityRoute, Groups, Subresource } from "@astahmer/entity-routes/";

@Pagination()
@Search([], { all: true, allNested: true })
@EntityRoute("/memes", ["create", "list", "details", "update", "delete"], {
    actions: [
        {
            verb: "get",
            path: "/search",
            class: SearchAction,
        },
        {
            verb: "get",
            path: "/list",
            class: ListAction,
        },
        {
            verb: "get",
            path: "/:id(\\d+)/isInAnyBank",
            handler: IsFavoritedOrInAnyBankAction,
        },
        {
            verb: "get",
            path: "/:id(\\d+)/isInBank/:bankId(\\d+)",
            handler: IsInBankAction,
        },
    ],
})
@Unique(["image", "owner"])
@IsUnique<Meme>(["image", "owner"])
// TODO @Owner(path="owner") / relationPath vers l'owner pour permission (such as delete entity)
@Entity()
export class Meme extends AbstractEntity {
    @ArrayNotEmpty({ message: "A meme requires at least one tag" })
    @Groups({ meme: ["create", "list", "details", "update"] })
    @OneToMany(() => Tag, (tag) => tag.meme, { cascade: true })
    tags: Tag[];

    @Groups({ meme: ["list", "details", "update"] })
    @Column({ default: 0 })
    upvoteCount: number;

    @Groups({ meme: ["list", "details", "update"] })
    @Column({ default: 0 })
    downvoteCount: number;

    @Groups({ meme: ["details", "update"] })
    @Column({ default: 0 })
    views: number;

    @IsNotEmpty()
    // TODO @IsRelation + @IsArrayRelation ? (ok si relationProp: number|iri|{ id: number })
    @Groups({ meme: ["create", "list", "details", "update"] })
    @OneToOne(() => Image, (image) => image.meme, { cascade: true })
    @JoinColumn()
    image: Image;

    @ArrayMaxSize(4)
    @Groups({ meme: ["create", "list", "details", "update"] })
    @OneToMany(() => Image, (picture) => picture.multipartMeme, { cascade: true })
    pictures: Image[];

    @Column({ default: false })
    isMultipartMeme: boolean;

    @Groups({ meme: ["create", "list", "details", "update"] })
    @ManyToMany(() => MemeBank, (bank) => bank.memes)
    banks: MemeBank[];

    @Subresource(() => Comment)
    @OneToMany(() => Comment, (comment) => comment.meme)
    comments: Comment[];

    @IsCurrentUser()
    // TODO @AsCurrentUser ? Autofill field with decoded token.id without needing to pass it in request body
    @Groups({ meme: ["create", "details", "list"] })
    @ManyToOne(() => User, (user) => user.postedMemes)
    owner: User;

    @ManyToMany(() => User, (user) => user.favorites)
    favoritedByUsers: User[];

    @Groups({ meme: ["create", "details", "update"] })
    @Column({ type: "enum", enum: Visibility, default: Visibility.PUBLIC })
    visibility: Visibility;
}

async function isMemeInBank(memeId: number, { bankId, userId }: { bankId?: number; userId?: number }) {
    const connection = getConnection();
    const query = await connection
        .getRepository(Meme)
        .createQueryBuilder("meme")
        .select("meme.id")
        .innerJoin("meme.banks", "bank")
        .where("meme.id = :memeId", { memeId });

    if (bankId) {
        query.andWhere("bank.id = :bankId", { bankId });
    } else if (userId) {
        query.andWhere("bank.ownerId = :userId", { userId });
    }

    const meme = query.getOne();

    return meme;
}

const isMemeInAnyUserBank = (memeId: number, userId: number) => isMemeInBank(memeId, { userId });

async function isMemeFavoritedByUser(memeId: number, userId: number) {
    const connection = getConnection();
    const query = connection
        .getRepository(Meme)
        .createQueryBuilder("meme")
        .select("meme.id")
        .innerJoin("meme.favoritedByUsers", "users")
        .where("meme.id = :memeId", { memeId })
        .andWhere("users.id = :userId", { userId });
    const meme = query.getOne();

    return meme;
}

async function IsInBankAction(ctx: Context) {
    try {
        const foundMeme = await isMemeInBank(ctx.params.id, { bankId: ctx.params.bankId });
        ctx.body = { result: !!foundMeme };
    } catch (error) {
        logger.error(error);
        ctx.throw(400);
    }
}

async function IsFavoritedOrInAnyBankAction(ctx: Context) {
    try {
        const decoded = await isTokenValid(ctx.req.headers.authorization);
        const [foundMemeInBank, foundMemeInFavorites] = await Promise.all([
            isMemeInAnyUserBank(ctx.params.id, decoded.id),
            isMemeFavoritedByUser(ctx.params.id, decoded.id),
        ]);

        ctx.body = { result: !!(foundMemeInBank || foundMemeInFavorites) };
    } catch (error) {
        logger.error(error);
        ctx.throw(400);
    }
}
