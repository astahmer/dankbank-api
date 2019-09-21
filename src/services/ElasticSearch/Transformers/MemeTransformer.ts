import { ITransformer } from "./ITransformer";
import { Meme } from "@/entity/Meme";
import { getImageURL } from "@/services/EntityRoute/Actions/ImageUploadAction";

export class MemeTransformer implements ITransformer<Meme> {
    transform(meme: Meme) {
        const tags = meme.tags.map((item) => ({ tag: item.tag, upvoteCount: item.upvoteCount }));
        const pictures = meme.pictures.map((item) => ({
            iri: item.getIri(),
            url: getImageURL(item.name),
            id: item.id,
            originalName: item.originalName,
            name: item.name,
            size: item.size,
        }));
        const banks = meme.tags.map((item) => item.getIri());

        return {
            ...meme,
            tags,
            pictures,
            banks,
            owner: meme.owner && meme.owner.getIri(),
            iri: meme.getIri(),
        };
    }
}