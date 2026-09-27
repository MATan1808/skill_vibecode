import type { Block } from 'payload'

export const {{BlockName}}Block: Block = {
  slug: '{{blockSlug}}',
  interfaceName: '{{BlockName}}BlockType',
  labels: {
    singular: '{{BlockName}} Block',
    plural: '{{BlockName}} Blocks',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      localized: true,
    },
    {
      name: 'headline',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      maxRows: 8,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'subtitle',
          type: 'text',
          localized: true,
        },
        {
          name: 'icon',
          type: 'text',
        },
      ],
    },
  ],
}
