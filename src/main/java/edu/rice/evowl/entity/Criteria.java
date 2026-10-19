package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("assignment criteria")
public class Criteria {

  @ApiModelProperty("primary key")
  private String unique_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("criteria id")
  private Long criteria_id;

  @ApiModelProperty("criteria text")
  private String criteria_text;

  @ApiModelProperty("is free response")
  private boolean is_free_response;

  @ApiModelProperty("eval type")
  private boolean eval_type;

  @ApiModelProperty("max character")
  private Long max_char;
}
