import { getImageRelativeURL } from "@/services/ImageManager";

import { ITransformer } from "./ITransformer";
import { Image } from "@/entity/Image";
import { Meme } from "@/entity/Meme";

export class MemeTransformer implements ITransformer<Meme> {
    transform(meme: Meme) {
        const tags = meme.tags.map((tag) => tag.tag);
        const formatImage = (item: Image) => ({
            "@id": item.getIri(),
            iri: item.getIri(),
            url: getImageRelativeURL(item.name),
            id: item.id,
            originalName: item.originalName,
            name: item.name,
            qualities: item.qualities,
            ratio: item.getRatio(),
        });
        const image = meme.image ? formatImage(meme.image) : null;
        const pictures = meme.pictures.map(formatImage);
        const banks = meme.banks.map((item) => item.getIri());

        return {
            ...meme,
            tags,
            tags_suggest: tags,
            image,
            pictures,
            banks,
            owner: meme.owner?.getIri(),
            ownerId: meme.owner?.id,
            iri: meme.getIri(),
            "@id": meme.getIri(),
        };
    }
}
