import Link from "next/link";

import { MaterialFormDialog } from "@/components/materials/material-form-dialog";
import { MaterialName } from "@/components/ui/category-swatch";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/status-badge";
import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  TableScroller,
  rowLinkClasses,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { countLabel, formatDate, formatUnitPriceValue } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import { getOrgContext } from "@/server/context";
import { countMaterialUsage, listMaterials } from "@/server/queries/materials";

export const metadata = { title: "Matières" };

export default async function MaterialsPage() {
  const { organization } = await getOrgContext();
  const [materials, usage] = await Promise.all([
    listMaterials(organization.id, { includeInactive: true }),
    countMaterialUsage(organization.id),
  ]);

  return (
    <>
      <PageHeader
        title="Matières et prix d'achat"
        context={`${countLabel(materials.filter((m) => m.isActive).length, "matière active", "matières actives")} · prix internes de référence`}
        actions={<MaterialFormDialog />}
      />
      <div className="flex flex-col gap-4 p-5">
        <Notice tone="info">
          Les prix affichés sont des <strong>prix de démonstration</strong> propres à cet espace.
          Ils ne reflètent pas les cours du marché.
        </Notice>
        <section className="panel">
          <TableScroller>
            <Table>
              <THead>
                <tr>
                  <Th>Code</Th>
                  <Th>Matière</Th>
                  <Th>Catégorie</Th>
                  <Th numeric>Prix d&apos;achat</Th>
                  <Th>Unité</Th>
                  <Th numeric>Réceptions</Th>
                  <Th>Mis à jour</Th>
                  <Th>Statut</Th>
                </tr>
              </THead>
              <TBody>
                {materials.map((material) => (
                  <Tr
                    key={material.id}
                    className={cn(
                      rowLinkClasses,
                      "relative",
                      !material.isActive && "text-ink-muted",
                    )}
                  >
                    <Td className="font-mono text-xs">{material.code}</Td>
                    <Td>
                      <Link
                        href={`/matieres/${material.id}`}
                        className="after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        <MaterialName name={material.name} category={material.category} />
                      </Link>
                    </Td>
                    <Td className="text-ink-secondary">{CATEGORY_LABELS[material.category]}</Td>
                    <Td numeric className="font-medium">
                      {formatUnitPriceValue(
                        material.currentPurchasePriceCtsPerT,
                        material.priceUnit,
                      )}
                    </Td>
                    <Td className="text-ink-secondary">CHF/{material.priceUnit}</Td>
                    <Td numeric className="text-ink-secondary">
                      {usage.get(material.id) ?? 0}
                    </Td>
                    <Td className="tnum text-ink-secondary">{formatDate(material.updatedAt)}</Td>
                    <Td>{material.isActive ? <Tag>Active</Tag> : <Tag>Désactivée</Tag>}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableScroller>
        </section>
      </div>
    </>
  );
}
