package edu.rice.evowl.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

public interface CriteriaMapper {
  @Select(
    "SELECT criteria_id, criteria_text, free_response, eval_type, max_char FROM criteria WHERE assignment_id = #{assignment_id} AND eval_type = #{eval_type} ORDER BY criteria_id"
  )
  @Results(
    id = "criteriaResultMap",
    value = {
      @Result(property = "criteriaId", column = "criteria_id"),
      @Result(property = "criteriaText", column = "criteria_text"),
      @Result(property = "isFreeResponse", column = "free_response"),
      @Result(property = "evalType", column = "eval_type"),
      @Result(property = "maxChar", column = "max_char"),
    }
  )
  List<Map<String, Object>> getCriteriaFormatByAssignId(
    @Param("assignment_id") Long assignment_id,
    @Param("eval_type") int eval_type
  );

  @Select(
    "SELECT criteria_id, criteria_text, free_response, eval_type, max_char FROM criteria WHERE assignment_id = #{assignment_id} ORDER BY criteria_id"
  )
  @Results(
    id = "criteriaResultMapAll",
    value = {
      @Result(property = "criteriaId", column = "criteria_id"),
      @Result(property = "criteriaText", column = "criteria_text"),
      @Result(property = "isFreeResponse", column = "free_response"),
      @Result(property = "evalType", column = "eval_type"),
      @Result(property = "maxChar", column = "max_char"),
    }
  )
  List<Map<String, Object>> getAllCriteriaFormatByAssignId(
    @Param("assignment_id") Long assignment_id
  );

  @Select(
    "SELECT criteria_text, free_response, eval_type, max_char FROM criteria WHERE assignment_id = #{assignment_id} AND criteria_id = #{criteria_id} AND eval_type = #{eval_type} LIMIT 1"
  )
  @Results(
    id = "criteriaResultMap2",
    value = {
      @Result(property = "criteriaText", column = "criteria_text"),
      @Result(property = "isFreeResponse", column = "free_response"),
      @Result(property = "evalType", column = "eval_type"),
      @Result(property = "maxChar", column = "max_char"),
    }
  )
  Map<String, Object> getCriteriaFormatByCriteriaId(
    @Param("assignment_id") Long assignment_id,
    @Param("criteria_id") Long criteriaId,
    @Param("eval_type") int eval_type
  );

  @Select(
    "SELECT COUNT(*) FROM criteria WHERE assignment_id = #{assignment_id} AND eval_type = 1 AND free_response = 1"
  )
  int getNumSelfFRQuestions(@Param("assignment_id") Long assignment_id);

  @Select(
    "SELECT COALESCE(MIN(criteria_id), 0) FROM criteria WHERE assignment_id = #{assignment_id} AND free_response = 1 AND eval_type = #{eval_type}"
  )
  int findSmallestCriteriaIdWithFreeResponse(
    @Param("assignment_id") Long assignment_id,
    @Param("eval_type") int eval_type
  );
}
