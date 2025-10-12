import { apiRequest } from './client'
import {
  SpaceResponse,
  GetSpacesResponse,
  CreateSpaceRequest,
  UpdateSpaceRequest
} from '../../types'

export const spacesApi = {
  getSpaces: async (limit = 100, offset = 0): Promise<GetSpacesResponse> => {
    return apiRequest<GetSpacesResponse>(`/spaces?limit=${limit}&offset=${offset}`)
  },
  createSpace: async (request: CreateSpaceRequest): Promise<SpaceResponse> => {
    return apiRequest<SpaceResponse>('/spaces', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
  updateSpace: async (spaceId: string, request: UpdateSpaceRequest): Promise<SpaceResponse> => {
    return apiRequest<SpaceResponse>(`/spaces/${spaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  },
  deleteSpace: async (spaceId: string): Promise<void> => {
    return apiRequest<void>(`/spaces/${spaceId}`, {
      method: 'DELETE',
    })
  },
}
