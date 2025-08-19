/**
 * HuggingFace Models API Endpoint
 * 
 * Provides access to HuggingFace model data with filtering and pagination
 * 
 * Usage:
 * - GET /api/huggingface/models - List all models
 * - GET /api/huggingface/models?company_id=uuid - Models for specific company
 * - GET /api/huggingface/models?task=text-generation - Models by task
 * - GET /api/huggingface/models?author=openai - Models by author
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { dataSyncService } from '@/lib/data-sync-service';
import { logInfo, logError, logDebug } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const companyId = searchParams.get('company_id');
    const task = searchParams.get('task');
    const author = searchParams.get('author');
    const framework = searchParams.get('framework');
    const minDownloads = parseInt(searchParams.get('min_downloads') || '0', 10);
    const minLikes = parseInt(searchParams.get('min_likes') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sort_by') || 'downloads'; // downloads, likes, updated_at
    const sortOrder = searchParams.get('sort_order') || 'desc';

    const supabase = createServiceClient();

    // Build the query
    let query = supabase
      .from('huggingface_models')
      .select(`
        id,
        model_id,
        author,
        model_name,
        task,
        framework,
        downloads,
        likes,
        trending_score,
        created_at_hf,
        updated_at_hf,
        last_modified_hf,
        tags,
        library_name,
        pipeline_tag,
        private,
        gated,
        disabled,
        model_card_url,
        repository_url,
        last_synced_at,
        company_huggingface_models!inner(
          company_id,
          is_primary,
          confidence_score,
          discovery_method
        )
      `)
      .gte('downloads', minDownloads)
      .gte('likes', minLikes)
      .eq('disabled', false); // Only show enabled models

    // Apply filters
    if (companyId) {
      query = query.eq('company_huggingface_models.company_id', companyId);
    }

    if (task) {
      query = query.eq('task', task);
    }

    if (author) {
      query = query.ilike('author', `%${author}%`);
    }

    if (framework) {
      query = query.eq('framework', framework);
    }

    // Apply sorting
    const validSortFields = ['downloads', 'likes', 'trending_score', 'updated_at_hf', 'created_at_hf'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'downloads';
    const ascending = sortOrder === 'asc';

    query = query.order(sortField, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: models, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch HuggingFace models: ${error.message}`);
    }

    // Get additional statistics
    const { data: stats } = await supabase.rpc('get_huggingface_data_quality');

    logDebug('🤗 HuggingFace models API request', {
      filters: { companyId, task, author, framework, minDownloads, minLikes },
      pagination: { limit, offset },
      sorting: { sortBy: sortField, sortOrder },
      resultCount: models?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: `Retrieved ${models?.length || 0} HuggingFace models`,
      data: {
        models: models || [],
        pagination: {
          limit,
          offset,
          total: count,
          hasMore: count ? count > offset + limit : false
        },
        filters: {
          companyId,
          task,
          author,
          framework,
          minDownloads,
          minLikes
        },
        sorting: {
          field: sortField,
          order: sortOrder
        },
        statistics: stats || {}
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ HuggingFace models API error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch HuggingFace models',
      error: errorMessage
    }, { status: 500 });
  }
}

// POST endpoint for manually adding model associations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, modelId, isPrimary = false, notes } = body;

    if (!companyId || !modelId) {
      return NextResponse.json({
        success: false,
        message: 'companyId and modelId are required'
      }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify the model exists
    const { data: model, error: modelError } = await supabase
      .from('huggingface_models')
      .select('id, model_id, author')
      .eq('model_id', modelId)
      .single();

    if (modelError || !model) {
      return NextResponse.json({
        success: false,
        message: `Model ${modelId} not found in database`
      }, { status: 404 });
    }

    // Verify the company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({
        success: false,
        message: `Company ${companyId} not found`
      }, { status: 404 });
    }

    // Create the association
    const { data: association, error: assocError } = await supabase
      .from('company_huggingface_models')
      .insert({
        company_id: companyId,
        model_id: model.id,
        is_primary: isPrimary,
        discovery_method: 'manual',
        confidence_score: 1.0,
        notes: notes || `Manually associated ${modelId} with ${company.name}`
      })
      .select()
      .single();

    if (assocError) {
      // Handle duplicate association
      if (assocError.code === '23505') {
        return NextResponse.json({
          success: false,
          message: `Model ${modelId} is already associated with ${company.name}`
        }, { status: 409 });
      }
      throw new Error(`Failed to create association: ${assocError.message}`);
    }

    // Trigger sync to update companies table
    await dataSyncService.syncHuggingFaceDataToCompanies();

    logInfo('🔗 Manual HuggingFace model association created', {
      companyName: company.name,
      modelId,
      isPrimary
    });

    return NextResponse.json({
      success: true,
      message: `Successfully associated ${modelId} with ${company.name}`,
      data: {
        association,
        company: company,
        model: {
          id: model.id,
          model_id: model.model_id,
          author: model.author
        }
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ HuggingFace model association error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to create model association',
      error: errorMessage
    }, { status: 500 });
  }
}

// DELETE endpoint for removing model associations
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const modelId = searchParams.get('model_id');

    if (!companyId || !modelId) {
      return NextResponse.json({
        success: false,
        message: 'company_id and model_id query parameters are required'
      }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find the association
    const { data: association, error: findError } = await supabase
      .from('company_huggingface_models')
      .select(`
        id,
        companies!inner(name),
        huggingface_models!inner(model_id)
      `)
      .eq('company_id', companyId)
      .eq('huggingface_models.model_id', modelId)
      .single();

    if (findError || !association) {
      return NextResponse.json({
        success: false,
        message: `Association between company ${companyId} and model ${modelId} not found`
      }, { status: 404 });
    }

    // Delete the association
    const { error: deleteError } = await supabase
      .from('company_huggingface_models')
      .delete()
      .eq('id', association.id);

    if (deleteError) {
      throw new Error(`Failed to delete association: ${deleteError.message}`);
    }

    // Trigger sync to update companies table
    await dataSyncService.syncHuggingFaceDataToCompanies();

    logInfo('🗑️ HuggingFace model association removed', {
      companyId,
      modelId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully removed association between ${association.companies?.name || 'Unknown Company'} and ${association.huggingface_models?.model_id || 'Unknown Model'}`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logError('❌ HuggingFace model association deletion error', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to remove model association',
      error: errorMessage
    }, { status: 500 });
  }
}