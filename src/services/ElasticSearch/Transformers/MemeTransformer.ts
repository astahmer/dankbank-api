import { Meme } from "@/entity/Meme";
import { getImageRelativeURL } from "@/services/EntityRoute/ImageManager";

import { ITransformer } from "./ITransformer";

export class MemeTransformer implements ITransformer<Meme> {
    transform(meme: Meme) {
        const tags = meme.tags.map((tag) => tag.tag);
        const pictures = meme.pictures.map((item) => ({
            iri: item.getIri(),
            url: getImageRelativeURL(item.name),
            id: item.id,
            originalName: item.originalName,
            name: item.name,
            qualities: item.qualities,
            ratio: item.getRatio(),
        }));
        const banks = meme.banks.map((item) => item.getIri());

        return {
            ...meme,
            tags,
            tags_suggest: tags,
            pictures,
            banks,
            owner: meme.owner && meme.owner.getIri(),
            iri: meme.getIri(),
        };
    }
}
